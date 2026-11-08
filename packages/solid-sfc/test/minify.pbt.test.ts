import * as fc from 'fast-check';
import { parse } from 'postcss';
import type { Container, Document } from 'postcss';
import { describe, expect, it } from 'vitest';
import { minifyCSS } from '../src/minify.ts';

// A fixed seed makes a failure reproducible. fast-check prints the seed, the
// path and the shrunk input when a property fails.
// FC_SEED and FC_RUNS explore other inputs.
const parameters: fc.Parameters<unknown> = {
  seed: Number(process.env.FC_SEED ?? 20261108),
  numRuns: Number(process.env.FC_RUNS ?? 400),
};

const space = fc.constantFrom('', ' ', '  ', '\n', '\t', ' \n ');
const gap = fc.constantFrom(' ', '  ', '\n', '\t', ' \n ');
const ident = fc.stringMatching(/^[a-z][a-z0-9-]{0,6}$/);

// Comments hold NOTE, which no other generated text has.
const comment = fc.stringMatching(/^[a-z ,;:{}"'()\n]{0,12}$/).map((text) => `/*NOTE${text}*/`);

// Strings with spaces, separators, comment marks and escapes. A quote inside
// is always escaped.
const quoted = fc
  .tuple(
    fc.constantFrom('"', "'"),
    fc.array(
      fc.constantFrom('a', ' ', '  ', ',', ';', ':', '{', '}', '/*', '*/', '(', ')', '>', '+'),
      { maxLength: 6 },
    ),
    fc.array(fc.constantFrom('\\"', "\\'", '\\\\', '\\201C ', '\\\n'), { maxLength: 2 }),
  )
  .map(([quote, plain, escapes]) => `${quote}${plain.join('')}${escapes.join('')}${quote}`)
  // `\"` inside `'...'` is fine, but `\'` inside `"..."` is too: both are escapes.
  .filter((text) => text.length >= 2);

const url = fc
  .tuple(space, fc.stringMatching(/^[a-z]{1,5}:\/\/[a-z]{1,5}\.[a-z]{2,3}\/[a-z.]{0,6}$/), space)
  .map(([before, path, after]) => `url(${before}${path}${after})`);

const call = fc
  .tuple(ident, space, fc.array(ident, { minLength: 1, maxLength: 3 }), space)
  .map(([name, open, args, close]) => `${name}(${open}${args.join(' , ')}${close})`);

// An identifier that ends in an escaped character outside a string, such as
// `a\ ` or `a\"`. The escaped character is part of the token.
const escaped = fc
  .tuple(ident, fc.constantFrom(' ', '"', "'", ',', '>', '\\', '{'))
  .map(([name, char]) => `${name}\\${char}`);

const valueToken = fc.oneof(
  ident,
  escaped,
  fc.integer({ min: 0, max: 99 }).map((n) => `${n}px`),
  quoted,
  url,
  call,
);

// Tokens joined by whitespace or commas.
const value = fc
  .array(fc.tuple(fc.oneof(gap, fc.constant(' , ')), valueToken), { maxLength: 3 })
  .chain((rest) => valueToken.map((first) => first + rest.map(([g, t]) => g + t).join('')));

const declaration = fc
  .tuple(space, ident, space, space, value, space, fc.boolean(), space)
  .map(
    ([a, prop, b, c, text, d, important, e]) =>
      `${a}${prop}${b}:${c}${text}${d}${important ? `!${e}important` : ''}`,
  );

const compound = fc
  .tuple(
    fc.option(ident, { nil: '' }),
    fc.array(
      fc.oneof(
        ident.map((name) => `.${name}`),
        escaped.map((name) => `.${name}`),
        ident.map((name) => `#${name}`),
        ident.map((name) => `:${name}`),
        ident.map((name) => `::${name}`),
        ident.map((name) => `[${name}]`),
        fc.tuple(ident, quoted).map(([name, text]) => `[${name}=${text}]`),
        fc
          .tuple(space, fc.integer({ min: 1, max: 5 }), space)
          .map(([a, n, b]) => `:nth-child(${a}${n}n${b}+${b}1${a})`),
      ),
      { maxLength: 3 },
    ),
  )
  .map(([tag, parts]) => `${tag}${parts.join('')}` || '*');

const complex = fc
  .tuple(
    compound,
    fc.array(fc.tuple(space, fc.constantFrom(' ', '>', '+', '~'), space, compound), {
      maxLength: 2,
    }),
  )
  .map(([first, rest]) => {
    let text = first;
    for (const [a, combinator, b, next] of rest) {
      text += combinator === ' ' ? ` ${next}` : `${a}${combinator}${b}${next}`;
    }
    return text;
  });

const selector = fc
  .array(fc.tuple(space, complex), { minLength: 1, maxLength: 3 })
  .map((items) => items.map(([a, item]) => a + item).join(','));

const declarations = fc
  .array(fc.tuple(declaration, space, comment, fc.boolean()), { maxLength: 3 })
  .map((items) => {
    let text = '';
    for (const [item, trailing, note, withNote] of items) {
      text += `${item};${trailing}${withNote ? note : ''}`;
    }
    return text;
  });

const rule = fc
  .tuple(selector, space, space, declarations, space)
  .map(([sel, a, b, inner, c]) => `${sel}${a}{${b}${inner}${c}}`);

const atRule = fc
  .tuple(
    fc.constantFrom('@media', '@supports'),
    gap,
    ident,
    space,
    fc.integer({ min: 1, max: 90 }),
    space,
    space,
    fc.array(fc.tuple(rule, space), { maxLength: 2 }),
  )
  .map(([name, g, feature, a, n, b, c, rules]) => {
    const inner = rules.map(([item, trailing]) => item + trailing).join('');
    return `${name}${g}(${a}${feature}${b}:${a}${n}px${b})${c}{${inner}}`;
  });

const stylesheet = fc
  .array(fc.tuple(space, fc.oneof(rule, rule, atRule, comment)), { maxLength: 4 })
  .map((items) => items.map(([a, item]) => a + item).join('') + ' ');

// A string, or an escape outside a string. Both stay as they are.
const STRING = /"(?:\\[^]|[^"\\])*"|'(?:\\[^]|[^'\\])*'|\\[^]/g;

interface Normalized {
  lines: string[];
  strings: string[];
}

/** Drops the whitespace that CSS does not need, with a method unlike the one of `minifyCSS`. */
function squeeze(text: string, separators: string, strings: string[]): string {
  const marked = text.replace(STRING, (match) => {
    strings.push(match);
    return '\u0000';
  });
  const characters = separators.replace(/[\]\\^-]/g, '\\$&');
  return marked
    .replace(/\s+/g, ' ')
    .trim()
    .replace(new RegExp(`\\s*([${characters}])\\s*`, 'g'), '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')');
}

/** The rules, selectors, declarations and values of a stylesheet, without comments. */
function normalize(css: string): Normalized {
  const strings: string[] = [];
  const lines: string[] = [];
  parse(css).walk((node) => {
    if (node.type === 'comment') {
      return;
    }
    let depth = 0;
    let parent: Container | Document | undefined = node.parent;
    while (parent && parent.type !== 'root') {
      depth++;
      parent = parent.parent;
    }
    const prefix = `${depth}:${node.type}:`;
    if (node.type === 'rule') {
      lines.push(prefix + squeeze(node.selector, ',>+~', strings));
    } else if (node.type === 'atrule') {
      lines.push(`${prefix}${node.name}:${squeeze(node.params, ',:', strings)}`);
    } else if (node.type === 'decl') {
      const important = node.important ? '!important' : '';
      lines.push(`${prefix}${node.prop.trim()}:${squeeze(node.value, ',', strings)}${important}`);
    }
  });
  return { lines, strings };
}

// Shrunk inputs of the properties below.
describe('escapes outside strings', () => {
  it.each([
    ['.a\\ ,.b{c:d}', '.a\\ ,.b{c:d}'],
    ['a{c:x\\,  d}', 'a{c:x\\, d}'],
    ['a{c:b\\"  d  "e  f"}', 'a{c:b\\" d "e  f"}'],
    ['a{c:d\\ ;}', 'a{c:d\\ }'],
    ['a{c:d\\ !important}', 'a{c:d\\ !important}'],
  ])('keeps the tokens of %s', (input, output) => {
    expect(minifyCSS(input)).toBe(output);
  });
});

describe('minifyCSS properties', () => {
  it('keeps the rules, selectors, declarations and values', () => {
    fc.assert(
      fc.property(stylesheet, (css) => {
        expect(normalize(minifyCSS(css))).toEqual(normalize(css));
      }),
      parameters,
    );
  });

  it('is idempotent', () => {
    fc.assert(
      fc.property(stylesheet, (css) => {
        const once = minifyCSS(css);
        expect(minifyCSS(once)).toBe(once);
      }),
      parameters,
    );
  });

  it('removes every comment and the space around braces', () => {
    fc.assert(
      fc.property(stylesheet, (css) => {
        const output = minifyCSS(css).replace(STRING, '""');
        expect(output).not.toContain('NOTE');
        expect(output).not.toMatch(/\s[{}]|[{};]\s/);
      }),
      parameters,
    );
  });

  it('keeps strings and escapes byte for byte', () => {
    fc.assert(
      fc.property(selector, quoted, space, (sel, text, gapText) => {
        const css = `${sel}{content${gapText}:${gapText}${text}}`;
        expect(minifyCSS(css)).toContain(`content:${text}`);
      }),
      parameters,
    );
  });

  it('keeps url() content byte for byte', () => {
    fc.assert(
      fc.property(ident, url, (prop, address) => {
        const text = address.replace(/^url\(\s*|\s*\)$/g, '');
        expect(minifyCSS(`a{${prop}:${address}}`)).toContain(text);
      }),
      parameters,
    );
  });
});
