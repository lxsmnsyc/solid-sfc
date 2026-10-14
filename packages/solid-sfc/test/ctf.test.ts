import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { transformCTF } from '../src/ctf.ts';
import { compile } from '../src/index.ts';

function transform(code: string): string {
  const output = transformCTF(code, {
    props: '$$props',
    fail(message) {
      throw new Error(message);
    },
  }).toString();
  const { errors } = parseSync('out.tsx', output, { lang: 'tsx', sourceType: 'module' });
  expect(errors.map((error) => error.message)).toEqual([]);
  return output;
}

/** The output without the import lines. */
function body(code: string): string {
  return transform(code)
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .join('\n')
    .trim();
}

describe('$signal', () => {
  it('declares a signal and reads it', () => {
    expect(transform('let count = $signal(0);\nconsole.log(count);')).toBe(
      "import { createSignal as __createSignal } from 'solid-js';\n" +
        'let [count, __set_count] = __createSignal(0);\nconsole.log(count());',
    );
  });

  it('keeps the options', () => {
    expect(body("let a = $signal(0, { name: 'a' });")).toBe(
      "let [a, __set_a] = __createSignal(0, { name: 'a' });",
    );
  });

  it('moves the type annotation to the call', () => {
    expect(body('let a: number | null = $signal(null);')).toBe(
      'let [a, __set_a] = __createSignal<number | null>(null);',
    );
  });

  it.each([
    ['a = 1;', '__set_a(() => (1));'],
    ['a += 2;', '__set_a((__value) => __value + (2));'],
    ['a ||= b;', '__set_a((__value) => __value || (b));'],
    ['a++;', '__set_a((__value) => __value + 1);'],
    ['--a;', '__set_a((__value) => __value - 1);'],
    ['for (;;a++) {}', 'for (;;__set_a((__value) => __value + 1)) {}'],
    ['b = a++;', 'b = ((__value) => (__set_a(__value + 1), __value))(a());'],
    ['a = a + 1;', '__set_a(() => (a() + 1));'],
    ['const o = { a };', 'const o = { a: a() };'],
    ['const o = { a: a };', 'const o = { a: a() };'],
    ['const o = { [a]: 1 };', 'const o = { [a()]: 1 };'],
    ['f(a, x.a, a.x);', 'f(a(), x.a, a().x);'],
    ['const e = <p title={a}>{a}</p>;', 'const e = <p title={a()}>{a()}</p>;'],
    ['type T = typeof a;', 'type T = typeof a;'],
  ])('%s', (input, output) => {
    expect(body(`let a = $signal(0);\n${input}`)).toBe(
      `let [a, __set_a] = __createSignal(0);\n${output}`,
    );
  });

  it('resolves variables declared later', () => {
    expect(body('function f() { return a; }\nlet a = $signal(0);')).toBe(
      'function f() { return a(); }\nlet [a, __set_a] = __createSignal(0);',
    );
  });

  it('ignores shadowed variables', () => {
    expect(body('let a = $signal(0);\nconst f = (a) => a;\n{ let a = 1; a = 2; }')).toBe(
      'let [a, __set_a] = __createSignal(0);\nconst f = (a) => a;\n{ let a = 1; a = 2; }',
    );
  });

  it('dereferences a signal tuple', () => {
    expect(body('let a = $derefSignal(useCounter());\na = 1;')).toBe(
      'let [a, __set_a] = useCounter();\n__set_a(() => (1));',
    );
  });
});

describe('accessors', () => {
  it.each([
    ['$memo(a * 2)', '__createMemo(() => (a() * 2))'],
    ["$memo(a, { name: 'b' })", "__createMemo(() => (a()), undefined, { name: 'b' })"],
    ['$(a * 2)', '__createMemo(() => (a() * 2))'],
    ['$deferred(a)', '__createDeferred(() => (a()))'],
    ['$mapArray(a, (x) => x)', '__mapArray(() => (a()), (x) => x)'],
    ['$indexArray(a, (x) => x)', '__indexArray(() => (a()), (x) => x)'],
    ['$children(a)', '__children(() => (a()))'],
    ['$from(a)', '__from(a())'],
    ['$derefMemo(a)', 'a()'],
  ])('%s', (input, output) => {
    expect(body(`let a = $signal(0);\nconst b = ${input};\nb;`)).toBe(
      `let [a, __set_a] = __createSignal(0);\nconst b = ${output};\nb();`,
    );
  });

  it('moves the type annotation to the call', () => {
    expect(body('const b: string = $memo(x);')).toBe('const b = __createMemo<string>(() => (x));');
  });

  it('rejects writes', () => {
    expect(() => transform('const b = $memo(1);\nb = 2;')).toThrow('read-only');
    expect(() => transform('const b = $memo(1);\nb++;')).toThrow('read-only');
  });
});

describe('$destructure', () => {
  it('destructures into accessors', () => {
    expect(
      body(
        'const { a, b: c, d = def, e: { f }, ...rest } = $destructure(x);\ng(a, c, d, f, rest);',
      ),
    ).toBe(
      'const __source0 = x, a = () => __source0["a"], c = () => __source0["b"], ' +
        '__default1 = def, d = () => ((value) => value === undefined ? __default1 : value)(__source0["d"]), ' +
        '__object2 = () => __source0["e"], f = () => __object2()["f"], ' +
        'rest = __splitProps(__source0, ["a", "b", "d", "e"])[1];\n' +
        'g(a(), c(), d(), f(), rest);',
    );
  });

  it('evaluates computed keys once', () => {
    expect(body('const { [k]: a } = $destructure(x);')).toBe(
      'const __source0 = x, __key1 = k, a = () => __source0[__key1];',
    );
  });

  it('transforms reads in default values', () => {
    expect(body('let s = $signal(1);\nconst { a = s } = $destructure(x);')).toBe(
      'let [s, __set_s] = __createSignal(1);\n' +
        'const __source0 = x, __default1 = s(), a = () => ((value) => value === undefined ? __default1 : value)(__source0["a"]);',
    );
  });

  it('destructures props', () => {
    expect(body('const { a, ...rest } = $$props;\na;')).toBe(
      'const a = () => $$props["a"], rest = __splitProps($$props, ["a"])[1];\na();',
    );
  });

  it('rejects array patterns', () => {
    expect(() => transform('const [a] = $destructure(x);')).toThrow('Only object patterns');
  });
});

describe('references', () => {
  const signal = 'let a = $signal(0);\nconst b = $memo(a);\n';
  const declared = 'let [a, __set_a] = __createSignal(0);\nconst b = __createMemo(() => (a()));\n';

  it.each([
    ['$get(a)', 'a'],
    ['$get(b)', 'b'],
    ['$set(a)', '__set_a'],
    ['$refSignal(a)', '[a, __set_a]'],
    ['$refMemo(b)', 'b'],
  ])('%s', (input, output) => {
    expect(body(`${signal}const r = ${input};`)).toBe(`${declared}const r = ${output};`);
  });

  it('creates property accessors', () => {
    expect(body(`${signal}const o = { a: $property(a), b: $getter(b), [k]: $setter(a) };`)).toBe(
      `${declared}const o = { get a() { return a(); }, set a(__value) { __set_a(() => __value); }, ` +
        'get b() { return b(); }, set [k](__value) { __set_a(() => __value); } };',
    );
  });

  it.each([
    ['$get(x)', 'expects a reactive variable'],
    ['$set(b)', 'expects a signal'],
    ['$setter(b)', 'can only be used as an object property value'],
    ['{ x: $setter(b) }', 'expects a signal'],
  ])('rejects %s', (input, message) => {
    expect(() => transform(`${signal}const r = ${input};`)).toThrow(message);
  });
});

describe('functions', () => {
  it.each([
    ['$untrack(a)', '__untrack(() => (a))'],
    ['$batch(f(a))', '__batch(() => (f(a)))'],
    ['$selector(a)', '__createSelector(() => (a))'],
    ['$on(a, (v) => v)', '__on(() => (a), (v) => v)'],
    ['$observable(a)', '__observable(() => (a))'],
    ["$lazy(import('./A'))", "__lazy(() => (import('./A')))"],
    ['$root(render())', '__createRoot(() => (render()))'],
    ['$root((dispose) => dispose)', '__createRoot((dispose) => dispose)'],
    ['$effect(() => a)', '__createEffect(() => a)'],
    ['$mount(() => a)', '__onMount(() => a)'],
    ['$merge(a, b)', '__mergeProps(a, b)'],
    ['$store({})', '__createStore({})'],
    ['$uid()', '__createUniqueId()'],
  ])('%s', (input, output) => {
    expect(body(`const r = ${input};`)).toBe(`const r = ${output};`);
  });

  it('imports from the right module', () => {
    const output = transform('const s = $store({});\nconst m = $memo(1);');
    expect(output).toContain("import { createStore as __createStore } from 'solid-js/store';");
    expect(output).toContain("import { createMemo as __createMemo } from 'solid-js';");
  });

  it('turns $() statements into effects', () => {
    expect(body('$(console.log(a));')).toBe('__createEffect(() => (console.log(a)));');
  });

  it('leaves local functions alone', () => {
    expect(body('const $memo = (x) => x;\nconst a = $memo(1);\na;')).toBe(
      'const $memo = (x) => x;\nconst a = $memo(1);\na;',
    );
  });

  it.each([
    ['f($signal(0));', '$signal() can only be used in a variable declaration'],
    ['f($(a));', '$() can only be used in a variable declaration'],
    ['const [a] = $signal(0);', 'must be assigned to an identifier'],
    ['effect: { f(); }', 'label is not supported'],
  ])('rejects %s', (input, message) => {
    expect(() => transform(input)).toThrow(message);
  });
});

describe('components', () => {
  it('imports control flow components', () => {
    const output = transform('const e = <For each={x}>{(i) => <Dynamic component={i} />}</For>;');
    expect(output).toContain("import { For } from 'solid-js';");
    expect(output).toContain("import { Dynamic } from 'solid-js/web';");
  });

  it('keeps imported components', () => {
    const output = transform("import { For } from './for';\nconst e = <For />;");
    expect(output).not.toContain("from 'solid-js'");
  });
});

describe('compile', () => {
  it('reports errors at the location in the file', () => {
    expect(() => compile('<script>\n  let a = 1;\n  f($signal(0));\n</script>')).toThrow(
      expect.objectContaining({ line: 3, column: 5 }),
    );
  });

  it('transforms reads in the markup and the styles', () => {
    const { code } = compile(
      '<script>let size = $signal(1);</script><style>p { width: ${size}px }</style><p>{size}</p>',
      { scope: 'x' },
    );
    expect(code).toContain("'--s-x-0': (\nsize()\n)");
    expect(code).toContain('<p s-x style={__styleVariables()}>{size()}</p>');
  });

  it('destructures props with defaults', () => {
    const { code } = compile(
      '<script>const { label = "Hi" } = $props<{ label?: string }>();</script><b>{label}</b>',
    );
    expect(code).toContain(
      'const __default0 = "Hi", label = () => ((value) => value === undefined ? __default0 : value)($$props["label"]);',
    );
    expect(code).toContain('<b>{label()}</b>');
  });
});
