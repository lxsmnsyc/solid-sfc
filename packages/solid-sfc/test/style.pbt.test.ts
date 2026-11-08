import * as fc from 'fast-check';
import { parse } from 'postcss';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

// A fixed seed makes a failure reproducible. fast-check prints the seed, the
// path and the shrunk input when a property fails. FC_SEED and FC_RUNS
// explore other inputs.
const parameters: fc.Parameters<unknown> = {
  seed: Number(process.env.FC_SEED ?? 20261108),
  numRuns: Number(process.env.FC_RUNS ?? 400),
};

const ATTRIBUTE = '[s-x]';

/** Collapses whitespace, and drops it after commas, which the selector list keeps as written. */
function squeeze(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/, /g, ',').trim();
}

/** The stylesheet that `compile` makes for the `<style>` blocks, not minified. */
function scope(style: string, attributes = ''): string {
  const result = compile(`<style${attributes}>${style}</style>`, { scope: 'x', dev: true });
  return squeeze(result.css?.code ?? '');
}

const name = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/);
const pseudoClass = fc.constantFrom(
  ':hover',
  ':focus',
  ':first-child',
  ':not(.z)',
  ':nth-child(2n+1)',
);
const pseudoElement = fc.constantFrom(
  '::before',
  '::after',
  '::marker',
  '::selection',
  ':before',
  ':after',
);

interface Compound {
  /** The compound without its pseudo-element. */
  head: string;
  /** The pseudo-element, or an empty string. */
  pseudoElement: string;
}

const compound: fc.Arbitrary<Compound> = fc
  .tuple(
    fc.option(name, { nil: '' }),
    fc.array(
      fc.oneof(
        name.map((value) => `.${value}`),
        name.map((value) => `#${value}`),
        pseudoClass,
        name.map((value) => `[data-${value}]`),
      ),
      { maxLength: 3 },
    ),
    fc.option(pseudoElement, { nil: '' }),
  )
  .map(([tag, parts, element]) => {
    const head = tag + parts.join('');
    return { head: head || (element ? '' : '*'), pseudoElement: element };
  });

const combinator = fc.constantFrom(' ', ' > ', ' + ', ' ~ ');

/** A selector without commas, as a list of compounds and combinators. */
const complex = fc.tuple(compound, fc.array(fc.tuple(combinator, compound), { maxLength: 3 }));

function print(first: Compound, rest: [string, Compound][]): string {
  let text = first.head + first.pseudoElement;
  for (const [separator, item] of rest) {
    text += separator + item.head + item.pseudoElement;
  }
  return text;
}

/**
 * The attribute goes at the end of the last compound, before its pseudo-element.
 * With `atStart`, as in SCSS and Less, it goes after the type selector.
 */
function expectScoped(first: Compound, rest: [string, Compound][], atStart = false): string {
  const compounds = [first, ...rest.map(([, item]) => item)];
  const last = compounds.length - 1;
  let text = '';
  for (const [index, item] of compounds.entries()) {
    if (index > 0) {
      text += rest[index - 1]![0];
    }
    if (index !== last) {
      text += item.head + item.pseudoElement;
    } else if (atStart) {
      const tag = /^(?:[a-z][a-z0-9]*|\*)/.exec(item.head)?.[0] ?? '';
      text += tag + ATTRIBUTE + item.head.slice(tag.length) + item.pseudoElement;
    } else {
      text += item.head + ATTRIBUTE + item.pseudoElement;
    }
  }
  return text;
}

/** Wraps rules in an at-rule or not. */
const wrapper = fc.constantFrom('', '@media (width > 1px)', '@supports (display: grid)');

function wrap(at: string, rules: string): string {
  return at ? `${at} { ${rules} }` : rules;
}

describe('scoped selectors', () => {
  it('put the scope attribute last, before the pseudo-element', () => {
    fc.assert(
      fc.property(fc.array(complex, { minLength: 1, maxLength: 3 }), wrapper, (selectors, at) => {
        const input = selectors.map(([first, rest]) => print(first, rest)).join(', ');
        const expected = selectors.map(([first, rest]) => expectScoped(first, rest)).join(', ');
        expect(scope(wrap(at, `${input} { color: red }`))).toBe(
          squeeze(wrap(at, `${expected} { color: red }`)),
        );
      }),
      parameters,
    );
  });

  it.each(['scss', 'less'])('put the scope attribute at the start in %s', (lang) => {
    fc.assert(
      fc.property(fc.array(complex, { minLength: 1, maxLength: 3 }), (selectors) => {
        const input = selectors.map(([first, rest]) => print(first, rest)).join(', ');
        const expected = selectors
          .map(([first, rest]) => expectScoped(first, rest, true))
          .join(', ');
        expect(scope(`${input} { color: red }`, ` lang="${lang}"`)).toBe(
          squeeze(`${expected} { color: red }`),
        );
      }),
      parameters,
    );
  });

  // Shrunk inputs of the properties above.
  it.each([
    ['.a, ::before { color: red }', '.a[s-x],[s-x]::before { color: red }', ''],
    ['.a,\n::before { color: red }', '.a[s-x],[s-x]::before { color: red }', ''],
    ['.a, .b { color: red }', '[s-x].a,[s-x].b { color: red }', ' lang="scss"'],
    ['.a, .b { color: red }', '[s-x].a,[s-x].b { color: red }', ' lang="less"'],
  ])('keeps the compound of %j together', (input, output, attributes) => {
    expect(scope(input, attributes)).toBe(output);
  });

  it('are not scoped in global blocks', () => {
    fc.assert(
      fc.property(complex, ([first, rest]) => {
        const input = `${print(first, rest)} { color: red }`;
        expect(scope(input, ' global')).toBe(squeeze(input));
      }),
      parameters,
    );
  });
});

describe(':global(...)', () => {
  type Item = { global: false; value: Compound } | { global: true; value: string };

  const item: fc.Arbitrary<Item> = fc.oneof(
    compound.map((value): Item => ({ global: false, value })),
    complex.map(([first, rest]): Item => ({ global: true, value: print(first, rest) })),
  );

  const items = fc.tuple(item, fc.array(fc.tuple(combinator, item), { maxLength: 3 }));

  it('is replaced by its content, and the last other compound is scoped', () => {
    fc.assert(
      fc.property(items, wrapper, ([first, rest], at) => {
        const all = [first, ...rest.map(([, entry]) => entry)];
        const separators = rest.map(([separator]) => separator);
        let last = all.length - 1;
        while (last >= 0 && all[last]!.global) {
          last--;
        }
        let input = '';
        let expected = '';
        for (const [index, entry] of all.entries()) {
          const separator = index > 0 ? separators[index - 1]! : '';
          if (entry.global) {
            input += `${separator}:global(${entry.value})`;
            expected += separator + entry.value;
          } else {
            const { head, pseudoElement: element } = entry.value;
            input += separator + head + element;
            expected += separator + head + (index === last ? ATTRIBUTE : '') + element;
          }
        }
        expect(scope(wrap(at, `${input} { color: red }`))).toBe(
          squeeze(wrap(at, `${expected} { color: red }`)),
        );
      }),
      parameters,
    );
  });
});

describe('keyframes', () => {
  // Short names such as `s` also occur inside the words `1s` and `10ms`.
  const keyframe = fc.oneof(
    name.map((value) => `k${value}`),
    fc.constantFrom('s', 'ms', 'e'),
  );
  // Words of an `animation` value that are not keyframe names.
  const other = fc.constantFrom('1s', '0.5s', 'ease', 'infinite', 'linear', '2', 'ms', 's');

  it('are renamed together with the animations that use them', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(keyframe, { minLength: 1, maxLength: 3 }),
        fc.array(
          fc.tuple(
            fc.constantFrom('animation', 'animation-name', '-webkit-animation'),
            fc.array(fc.oneof(keyframe, other), { minLength: 1, maxLength: 4 }),
          ),
          { minLength: 1, maxLength: 3 },
        ),
        (names, uses) => {
          const frames = names.map((value) => `@keyframes ${value} { from { opacity: 0 } }`);
          const rules = uses.map(
            ([prop, words], index) => `.u${index} { ${prop}: ${words.join(' ')} }`,
          );
          const output = parse(scope([...frames, ...rules].join('\n')));

          const renamed: string[] = [];
          output.walkAtRules('keyframes', (rule) => {
            renamed.push(rule.params);
          });
          expect(renamed).toEqual(names.map((value) => `${value}-x`));

          const declarations: string[] = [];
          output.walkDecls(/animation/, (declaration) => {
            declarations.push(declaration.value);
          });
          expect(declarations).toEqual(
            uses.map(([, words]) =>
              words.map((word) => (names.includes(word) ? `${word}-x` : word)).join(' '),
            ),
          );
        },
      ),
      parameters,
    );
  });

  it('do not rename the unit of a time', () => {
    expect(scope('@keyframes s { from { opacity: 0 } } a { animation: s 1s ease 0.5s }')).toBe(
      '@keyframes s-x { from { opacity: 0 } } a[s-x] { animation: s-x 1s ease 0.5s }',
    );
  });

  it('keep the names of global blocks', () => {
    fc.assert(
      fc.property(keyframe, (value) => {
        const input = `@keyframes ${value} { from { opacity: 0 } } a { animation: ${value} 1s }`;
        expect(scope(input, ' global')).toBe(squeeze(input));
      }),
      parameters,
    );
  });
});
