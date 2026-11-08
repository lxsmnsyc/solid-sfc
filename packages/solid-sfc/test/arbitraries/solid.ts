/**
 * Arbitraries for `.solid` sources. `solidFile` builds files from the
 * grammar in the docs. `nearValid` breaks such files in small ways, so the
 * compiler also sees input that is almost right.
 */
import * as fc from 'fast-check';

const IDENTIFIERS = ['a', 'b', 'count', 'item', 'user', 'items', 'props', 'name', 'x1', '$v', '_w'];

const identifier = fc.constantFrom(...IDENTIFIERS);

const stringLiteral = fc.constantFrom(
  "'text'",
  '"text"',
  "'a}b'",
  '"a>b"',
  "'<div>'",
  "'it\\'s'",
  '"say \\"hi\\""',
  "'${x}'",
  "'`'",
  "''",
);

const regexLiteral = fc.constantFrom('/a+b/g', '/[}\\]]/', '/\\//', '/<\\/div>/i');

const numberLiteral = fc.constantFrom('0', '1', '42', '3.14', '1e3', '0x1f');

const templateLiteral = fc.oneof(
  fc.constantFrom('`plain`', '`a ${b} c`', '`${a}${b}`', '`}`', '`x ${`y ${z}`}`'),
  identifier.map((name) => `\`v-\${${name}}\``),
);

/** A JavaScript expression that is safe in parentheses, braces and arguments. */
const expressions = fc.letrec<{
  expr: string;
  atom: string;
  chain: string;
  plain: string;
}>((tie) => ({
  atom: fc.oneof(
    identifier,
    numberLiteral,
    stringLiteral,
    templateLiteral,
    regexLiteral,
    fc.constantFrom('true', 'false', 'null', 'undefined', '[]', '({})'),
  ),
  chain: fc.oneof(
    tie('atom'),
    fc.tuple(identifier, identifier).map(([a, b]) => `${a}.${b}`),
    fc.tuple(identifier, identifier).map(([a, b]) => `${a}?.${b}`),
    fc.tuple(identifier, tie('atom')).map(([a, b]) => `${a}(${b})`),
    fc.tuple(identifier, tie('atom'), tie('atom')).map(([a, b, c]) => `${a}(${b}, ${c})`),
    fc.tuple(identifier, tie('atom')).map(([a, b]) => `${a}[${b}]`),
    identifier.map((a) => `${a}!`),
  ),
  expr: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    tie('chain'),
    fc.tuple(tie('chain'), tie('chain')).map(([a, b]) => `${a} + ${b}`),
    fc.tuple(tie('chain'), tie('chain')).map(([a, b]) => `${a} > ${b}`),
    fc.tuple(tie('chain'), tie('chain'), tie('chain')).map(([a, b, c]) => `${a} ? ${b} : ${c}`),
    tie('chain').map((a) => `!${a}`),
    tie('chain').map((a) => `(${a})`),
    tie('chain').map((a) => `[${a}, ${a}]`),
    tie('chain').map((a) => `{ k: ${a} }`),
    tie('chain').map((a) => `(v) => ${a}`),
    tie('chain').map((a) => `/* } */ ${a}`),
    tie('chain').map((a) => `items.map((i) => <li>{${a}}</li>)`),
  ),
  plain: fc.oneof(
    tie('chain'),
    fc.tuple(tie('chain'), tie('chain')).map(([a, b]) => `${a} + ${b}`),
    tie('chain').map((a) => `(${a})`),
  ),
}));

export const expression: fc.Arbitrary<string> = expressions.expr;

/**
 * The list of a `#for`. The compiler looks for `of` and `by` in the header
 * text, so this one has no comments, regular expressions or elements.
 */
export const listExpression: fc.Arbitrary<string> = fc.oneof(
  identifier,
  fc.tuple(identifier, identifier).map(([a, b]) => `${a}.${b}`),
  fc.tuple(identifier, identifier).map(([a, b]) => `${a}(${b})`),
  fc.tuple(identifier, stringLiteral).map(([a, b]) => `${a}(${b})`),
);

/** An expression without elements, for places that cannot hold them, such as CSS. */
export const plainExpression: fc.Arbitrary<string> = expressions.plain;

const attributeName = fc.constantFrom(
  'id',
  'class',
  'title',
  'onClick',
  'value',
  'aria-label',
  'data-x',
  'use:ref',
  'class:active',
  'xlink:href',
  'disabled',
  'style',
  'tabIndex',
  'alt',
  'href',
  'role',
);

const attributeValue = fc.oneof(
  identifier,
  fc.tuple(identifier, identifier).map(([a, b]) => `${a}.${b}`),
  fc.tuple(identifier, identifier).map(([a, b]) => `${a}(${b}, 1)`),
  identifier.map((a) => `${a}[0]?.label`),
  identifier.map((a) => `!${a}`),
  numberLiteral,
  fc.constantFrom('true', 'false', 'null'),
  fc.constantFrom("'text'", '"text"', "'a}b'", '"a>b"', "'<div>'"),
  expression.map((text) => `(${text})`),
  templateLiteral,
  fc.constantFrom('[1, 2]', '[a, [b]]'),
  regexLiteral,
  fc.constantFrom("{ color: 'red' }", '{ a: 1, b: { c: 2 } }', '{ done }'),
  fc.constantFrom('<b>x</b>', '<Icon />', '<>y</>'),
);

const attribute = fc.oneof(
  fc.tuple(attributeName, attributeValue).map(([name, value]) => `${name}=${value}`),
  fc.tuple(attributeName, fc.constantFrom('"x"', "'y z'", '""')).map(([n, v]) => `${n}=${v}`),
  attributeName,
  identifier.map((name) => `{${name}}`),
  identifier.map((name) => `{...${name}}`),
  fc.tuple(identifier, attributeValue).map(([name, value]) => `[${name}]=${value}`),
  identifier.map((name) => `[${name}]`),
);

function joinWith(list: string[], prefix: string, separator = ''): string {
  let result = '';
  for (const item of list) {
    result += prefix + item + separator;
  }
  return result;
}

const attributes = fc.array(attribute, { maxLength: 3 }).map((list) => joinWith(list, ' '));

const text = fc.constantFrom(
  'Hello',
  'Hello world',
  'C#',
  '#hashtag',
  '#if without parentheses',
  "it's",
  'a &amp; b',
  '',
);

const interpolation = expression.map((value) => `{${value}}`);

const NATIVE = ['div', 'span', 'p', 'ul', 'li', 'section', 'my-element', 'button', 'svg'];
const VOID = ['br', 'hr', 'input', 'img', 'meta'];

/** One piece of markup, with `depth` levels of nesting left. */
function node(depth: number): fc.Arbitrary<string> {
  const leaf = fc.oneof(text, interpolation, fc.constant('<!-- note -->'));
  const voidElement = fc
    .tuple(fc.constantFrom(...VOID), attributes)
    .map(([tag, attrs]) => `<${tag}${attrs}>`);
  const selfClosing = fc
    .tuple(fc.constantFrom('Button', 'Form.Field', 'Icon', 'div'), attributes)
    .map(([tag, attrs]) => `<${tag}${attrs} />`);
  if (depth <= 0) {
    return fc.oneof(leaf, voidElement, selfClosing);
  }
  const inner = fc.array(node(depth - 1), { maxLength: 2 });
  const nativeElement = fc
    .tuple(fc.constantFrom(...NATIVE, 'Button', 'Form.Field'), attributes, inner)
    .map(([tag, attrs, children]) => `<${tag}${attrs}>${children.join('\n')}</${tag}>`);
  const fragment = inner.map((children) => `<>${children.join('\n')}</>`);
  const dynamic = fc
    .tuple(expression, attributes, inner)
    .map(([tag, attrs, children]) => `<{${tag}}${attrs}>${children.join('\n')}</>`);
  return fc.oneof(
    { depthSize: 'small' },
    { weight: 2, arbitrary: leaf },
    { weight: 1, arbitrary: voidElement },
    { weight: 1, arbitrary: selfClosing },
    { weight: 2, arbitrary: nativeElement },
    { weight: 1, arbitrary: fragment },
    { weight: 1, arbitrary: dynamic },
    { weight: 6, arbitrary: controlBlock(depth - 1) },
  );
}

/** `#template`, which only fits at the top of a file or at the start of a block body. */
function template(depth: number): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.constantFrom('row', 'cell'),
      fc.constantFrom('(user: User, index: number)', '(a, b = 1)', '()'),
      fc.array(node(depth), { maxLength: 2 }),
    )
    .map(([name, params, list]) => `#template ${name}${params} {\n${list.join('\n')}\n}`);
}

function body(depth: number): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.option(template(depth - 1), { nil: undefined }),
      fc.array(node(depth), { maxLength: 2 }),
    )
    .map(
      ([declaration, list]) => ` {\n${declaration ? `${declaration}\n` : ''}${list.join('\n')}\n}`,
    );
}

function controlBlock(depth: number): fc.Arbitrary<string> {
  const content = body(depth);
  const optional = fc.option(content, { nil: undefined });
  const ifBlock = fc
    .tuple(
      expression,
      content,
      fc.option(fc.tuple(expression, content), { nil: undefined }),
      optional,
    )
    .map(
      ([test, first, elseIf, fallback]) =>
        `#if (${test})${first}` +
        (elseIf ? ` #else if (${elseIf[0]})${elseIf[1]}` : '') +
        (fallback ? ` #else${fallback}` : ''),
    );
  const forBlock = fc
    .tuple(
      fc.constantFrom('item', 'item, i', '{ id, title }', '[k, v]', 'item, index'),
      listExpression,
      fc.constantFrom('', ' by item.id', ' by index', ' by item'),
      content,
      optional,
    )
    .map(
      ([head, list, by, first, fallback]) =>
        `#for (${head} of ${list}${by})${first}${fallback ? ` #else${fallback}` : ''}`,
    );
  const repeat = fc
    .tuple(fc.constantFrom('3', 'i of 3', 'n of count'), content)
    .map(([head, inner]) => `#repeat (${head})${inner}`);
  const switchBlock = fc
    .tuple(fc.array(fc.tuple(expression, content), { maxLength: 3 }), optional)
    .map(([cases, fallback]) => {
      let result = '#switch {\n';
      for (const [test, inner] of cases) {
        result += `#case (${test})${inner}\n`;
      }
      return `${result}${fallback ? `#default${fallback}\n` : ''}}`;
    });
  const tryBlock = fc
    .tuple(content, fc.constantFrom('', ' (error)', ' (error, reset)'), content)
    .map(([first, head, second]) => `#try${first} #catch${head}${second}`);
  const loading = fc
    .tuple(fc.constantFrom('', ' (a)'), content, optional)
    .map(
      ([head, first, fallback]) => `#loading${head}${first}${fallback ? ` #else${fallback}` : ''}`,
    );
  const reveal = fc
    .tuple(fc.constantFrom('', " ('together')", " ('sequential', true)"), content)
    .map(([head, inner]) => `#reveal${head}${inner}`);
  const portal = fc
    .tuple(fc.constantFrom('', ' (container)'), content)
    .map(([head, inner]) => `#portal${head}${inner}`);
  const hydration = fc
    .tuple(fc.constantFrom('#no-hydration', '#hydration', "#hydration ('id')"), content)
    .map(([head, inner]) => `${head}${inner}`);
  const key = fc.tuple(expression, content).map(([test, inner]) => `#key (${test})${inner}`);
  return fc.oneof(
    { weight: 4, arbitrary: ifBlock },
    { weight: 4, arbitrary: forBlock },
    { weight: 1, arbitrary: repeat },
    { weight: 3, arbitrary: switchBlock },
    { weight: 3, arbitrary: tryBlock },
    { weight: 3, arbitrary: loading },
    { weight: 1, arbitrary: reveal },
    { weight: 1, arbitrary: portal },
    { weight: 1, arbitrary: hydration },
    { weight: 1, arbitrary: key },
  );
}

export const markup: fc.Arbitrary<string> = fc
  .tuple(fc.array(node(2), { maxLength: 3 }), fc.option(template(1), { nil: undefined }))
  .map(([list, declaration]) => [...list, ...(declaration ? [declaration] : [])].join('\n'));

/** A statement. `n` makes its names unique in the script. */
function scriptStatement(n: number): fc.Arbitrary<string> {
  return fc.oneof(
    expression.map((value) => `let s${n} = $signal(${value});`),
    expression.map((value) => `const m${n} = $memo(${value});`),
    expression.map((value) => `$effect(() => { console.log(${value}); });`),
    fc.constant(`const { a${n}, b${n} = 1 } = $props<{ a${n}: string; b${n}?: number }>();`),
    expression.map((value) => `function f${n}() { return ${value}; }`),
    fc.constant(`import { c${n} } from 'solid-js';`),
    fc.constant(`import type { T${n} } from 'solid-js';`),
    fc.constant(`const view${n} = <p class="x">{a}</p>;`),
    fc.constant('// a comment with } and <b>'),
    fc.constant(`type Item${n} = { id: number; label: string };`),
  );
}

export const scriptBlock: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom('', ' lang="ts"', ' generics="T"'),
    fc.array(fc.nat(3), { maxLength: 4 }).chain((kinds) => {
      const statements: fc.Arbitrary<string>[] = [];
      for (let n = 0; n < kinds.length; n++) {
        statements.push(scriptStatement(n));
      }
      return fc.tuple(...statements);
    }),
  )
  .map(([attrs, list]) => `<script${attrs}>\n${list.join('\n')}\n</script>`);

export const moduleScriptBlock: fc.Arbitrary<string> = fc
  .array(
    fc.constantFrom(
      "import { x } from './x';",
      'export const LIMIT = 3;',
      'const hidden = 1;',
      'export type Size = "s" | "m";',
    ),
    { maxLength: 3 },
  )
  .map((list) => `<script module>\n${list.join('\n')}\n</script>`);

const cssRule = fc.oneof(
  fc.constantFrom(
    '.item { color: red; }',
    'p::before { content: "}"; }',
    ':global(body) { margin: 0; }',
    '@media (min-width: 10px) { .a { top: 0; } }',
    '@keyframes spin { from { opacity: 0; } to { opacity: 1; } }',
    '.a { &:hover { color: blue; } }',
    '/* } */ ul li > a, b + i { margin: 1px; }',
    '.nope { color: var(--c); }',
  ),
  plainExpression.map((value) => `.dyn { width: \${${value}}; }`),
);

const globalRule = fc.constantFrom(
  '.item { color: red; }',
  ':global(body) { margin: 0; }',
  '@media (min-width: 10px) { .a { top: 0; } }',
);

export const styleBlock: fc.Arbitrary<string> = fc.oneof(
  fc.array(cssRule, { maxLength: 4 }).map((rules) => `<style>\n${rules.join('\n')}\n</style>`),
  fc
    .array(globalRule, { maxLength: 3 })
    .map((rules) => `<style global>\n${rules.join('\n')}\n</style>`),
);

/** A whole file: optional scripts and styles around the markup, in any order. */
export const solidFile: fc.Arbitrary<string> = fc
  .tuple(
    fc.option(moduleScriptBlock, { nil: undefined }),
    fc.option(scriptBlock, { nil: undefined }),
    fc.option(styleBlock, { nil: undefined }),
    markup,
    fc.nat(5),
  )
  .map(([moduleBlock, instance, css, rest, order]) => {
    const parts: string[] = [];
    for (const part of [moduleBlock, instance, css]) {
      if (part !== undefined) {
        parts.push(part);
      }
    }
    const turn = order % (parts.length || 1);
    return `${[...parts.slice(turn), ...parts.slice(0, turn), rest].join('\n\n')}\n`;
  });

const NOISE = [
  '<',
  '>',
  '{',
  '}',
  '(',
  ')',
  '#',
  '/',
  '"',
  "'",
  '`',
  '$',
  '[',
  ']',
  '=',
  '\n',
  ' ',
];

/** `source` with one small edit: a cut, an insertion, a deletion, a swap or a removed chunk. */
export function breakSource(source: string): fc.Arbitrary<string> {
  return fc
    .tuple(
      fc.constantFrom('cut', 'insert', 'delete', 'swap', 'chunk'),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 1, noNaN: true }),
      fc.constantFrom(...NOISE),
    )
    .map(([kind, p, q, noise]) => {
      const at = Math.floor(p * source.length);
      const other = Math.floor(q * source.length);
      const from = Math.min(at, other);
      const to = Math.max(at, other);
      switch (kind) {
        case 'cut':
          return source.slice(0, at);
        case 'insert':
          return source.slice(0, at) + noise + source.slice(at);
        case 'delete':
          return source.slice(0, at) + source.slice(at + 1);
        case 'chunk':
          return source.slice(0, from) + source.slice(to);
        default:
          return (
            source.slice(0, from) +
            (source[to] ?? '') +
            source.slice(from + 1, to) +
            (source[from] ?? '') +
            source.slice(to + 1)
          );
      }
    });
}

/** A valid file with one small edit. */
export const nearValid: fc.Arbitrary<string> = solidFile.chain(breakSource);

/** A valid file with several small edits. */
export const manyEdits: fc.Arbitrary<string> = solidFile
  .chain(breakSource)
  .chain(breakSource)
  .chain(breakSource);

/** One block with a small edit, followed by a line of markup. */
export const brokenBlock: fc.Arbitrary<string> = fc
  .oneof(styleBlock, scriptBlock, moduleScriptBlock)
  .chain(breakSource)
  .map((block) => `${block}\n<p />\n`);

/** Markup with a small edit. */
export const brokenMarkup: fc.Arbitrary<string> = markup.chain(breakSource);
