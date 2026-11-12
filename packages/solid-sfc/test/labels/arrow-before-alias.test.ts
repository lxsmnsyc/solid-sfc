import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../../src/labels/index.ts';

/**
 * Parses code and returns its statements without imports and source
 * positions, so two texts compare by structure and not by spacing.
 */
function parseBody(code: string): unknown {
  const result = parseSync('test.tsx', code, { lang: 'tsx', sourceType: 'module' });
  expect(result.errors).toEqual([]);
  const body = result.program.body.filter((node) => node.type !== 'ImportDeclaration');
  return JSON.parse(
    JSON.stringify(body, (key, value: unknown) =>
      key === 'start' || key === 'end' || key === 'range' ? undefined : value,
    ),
  );
}

/**
 * Compiles in default and dev mode and parses both outputs. The dev output is
 * compared with `devExpected`, or with `expected` when it is omitted. Pass
 * `null` to only require that the dev output parses.
 */
function expectCompiled(source: string, expected: string, devExpected?: string | null): void {
  const output = compile('test.tsx', source);
  expect(output).not.toBeNull();
  expect(parseBody(output?.code ?? '')).toEqual(parseBody(expected));

  const dev = compile('test.tsx', source, { dev: true });
  expect(dev).not.toBeNull();
  const devBody = parseBody(dev?.code ?? '');
  if (devExpected !== null) {
    expect(devBody).toEqual(parseBody(devExpected ?? expected));
  }
}

describe('arrow inserted before an argument that starts with an alias', () => {
  it('wraps an auto-aliased accessor', () => {
    expectCompiled(
      'const m = $memo($snapshot(x));',
      'const m = _createMemo(() => _snapshot(x));',
      'const m = _createMemo(() => _snapshot(x), { name: "m" });',
    );
    expectCompiled(
      'const m = $memo($merge(a, b));',
      'const m = _createMemo(() => _merge(a, b));',
      'const m = _createMemo(() => _merge(a, b), { name: "m" });',
    );
    expectCompiled(
      'const m = $memo($snapshot(s));',
      'const m = _createMemo(() => _snapshot(s));',
      'const m = _createMemo(() => _snapshot(s), { name: "m" });',
    );
  });

  it('wraps an alias that follows a newline', () => {
    expectCompiled(
      'const m = $memo(\n  $snapshot(x));',
      'const m = _createMemo(() => _snapshot(x));',
      'const m = _createMemo(() => _snapshot(x), { name: "m" });',
    );
  });

  it('keeps the arrow when the alias is not at the start', () => {
    expectCompiled(
      'const m = $memo(foo($snapshot(x)));',
      'const m = _createMemo(() => foo(_snapshot(x)));',
      'const m = _createMemo(() => foo(_snapshot(x)), { name: "m" });',
    );
  });

  it('wraps an alias argument of other arrow CTFs', () => {
    expectCompiled('const m = $untrack($snapshot(x));', 'const m = _untrack(() => _snapshot(x));');
    expectCompiled(
      'const m = $mapArray($snapshot(x), (v) => v);',
      'const m = _mapArray(() => _snapshot(x), (v) => v);',
    );
    expectCompiled(
      'const m = $children($snapshot(x));',
      'const m = _children(() => _snapshot(x));',
    );
  });

  it('wraps a component name used as a value', () => {
    expectCompiled(
      'const m = $memo(Show);',
      'const m = _createMemo(() => _Show);',
      'const m = _createMemo(() => _Show, { name: "m" });',
    );
    expectCompiled('const m = $untrack(Show);', 'const m = _untrack(() => _Show);');
  });

  it('wraps an arrow CTF argument that starts with another arrow CTF', () => {
    expectCompiled(
      'let c = $signal(0); const m = $memo($untrack($snapshot(c)));',
      'let [c, setC] = _createSignal(0); const m = _createMemo(() => _untrack(() => _snapshot(c())));',
      'let [c, setC] = _createSignal(0, { name: "c" }); const m = _createMemo(() => _untrack(() => _snapshot(c())), { name: "m" });',
    );
  });

  it('wraps a JSX component at the start of an argument', () => {
    expectCompiled(
      'const m = $untrack(<Show when={x}>a</Show>);',
      'const m = _untrack(() => <_Show when={x}>a</_Show>);',
    );
  });
});

describe('$signal initializers', () => {
  it('wraps an arrow CTF in the initializer', () => {
    expectCompiled(
      'let s = $signal($untrack(x));',
      'let [s, setS] = _createSignal(() => _untrack(() => x));',
      'let [s, setS] = _createSignal(() => _untrack(() => x), { name: "s" });',
    );
  });

  it('wraps an alias in the initializer', () => {
    expectCompiled(
      'let s = $signal($snapshot(x));',
      'let [s, setS] = _createSignal(() => _snapshot(x));',
      'let [s, setS] = _createSignal(() => _snapshot(x), { name: "s" });',
    );
  });

  it('leaves a component name as a static initializer', () => {
    expectCompiled(
      'let s = $signal(Show);',
      'let [s, setS] = _createSignal(_Show);',
      'let [s, setS] = _createSignal(_Show, { name: "s" });',
    );
  });
});

describe('arrow inserted before a signal access at the start of an argument', () => {
  const HEAD = 'let c = $signal(0); ';
  const OUT = 'let [c, setC] = _createSignal(0); ';
  const DEV_OUT = 'let [c, setC] = _createSignal(0, { name: "c" }); ';

  it('wraps a read', () => {
    expectCompiled(
      `${HEAD}const m = $memo(c + 1);`,
      `${OUT}const m = _createMemo(() => c() + 1);`,
      `${DEV_OUT}const m = _createMemo(() => c() + 1, { name: "m" });`,
    );
    expectCompiled(
      `${HEAD}const m = $memo(c);`,
      `${OUT}const m = _createMemo(() => c());`,
      `${DEV_OUT}const m = _createMemo(() => c(), { name: "m" });`,
    );
    expectCompiled(
      `${HEAD}const m = $memo({ c });`,
      `${OUT}const m = _createMemo(() => ({ c: c() }));`,
      `${DEV_OUT}const m = _createMemo(() => ({ c: c() }), { name: "m" });`,
    );
  });

  it('wraps a write', () => {
    expectCompiled(
      `${HEAD}const m = $untrack(c = 2);`,
      `${OUT}const m = _untrack(() => setC(() => 2));`,
      `${DEV_OUT}const m = _untrack(() => setC(() => 2));`,
    );
    expectCompiled(
      `${HEAD}const m = $memo(c += 2);`,
      `${OUT}const m = _createMemo(() => setC((current) => current += 2));`,
      `${DEV_OUT}const m = _createMemo(() => setC((current) => current += 2), { name: "m" });`,
    );
    expectCompiled(
      `${HEAD}const m = $untrack(c++);`,
      `${OUT}const m = _untrack(() => (() => { let tmp; setC((current) => (tmp = current) + 1); return tmp; })());`,
      `${DEV_OUT}const m = _untrack(() => (() => { let tmp; setC((current) => (tmp = current) + 1); return tmp; })());`,
    );
  });

  it('wraps a write through a TypeScript wrapper', () => {
    expectCompiled(
      `${HEAD}const m = $memo((c as any) = 3);`,
      `${OUT}const m = _createMemo(() => setC(() => 3));`,
      `${DEV_OUT}const m = _createMemo(() => setC(() => 3), { name: "m" });`,
    );
    expectCompiled(
      `${HEAD}const m = $memo(c! += 2);`,
      `${OUT}const m = _createMemo(() => setC((current) => current += 2));`,
      `${DEV_OUT}const m = _createMemo(() => setC((current) => current += 2), { name: "m" });`,
    );
    expectCompiled(
      `${HEAD}const m = $untrack((c as number)++);`,
      `${OUT}const m = _untrack(() => (() => { let tmp; setC((current) => (tmp = current) + 1); return tmp; })());`,
      `${DEV_OUT}const m = _untrack(() => (() => { let tmp; setC((current) => (tmp = current) + 1); return tmp; })());`,
    );
  });
});

describe('hoisted $effect', () => {
  it('keeps the arrows in a write that is the effect body', () => {
    expectCompiled(
      'let c = $signal(0);\n$effect(() => { c = $untrack($snapshot(x)); });',
      'let [c, setC] = _createSignal(0);\n_createEffect(() => [setC], effectCallback);\nfunction effectCallback([setC]) { setC(() => _untrack(() => _snapshot(x))); }',
      'let [c, setC] = _createSignal(0, { name: "c" });\n_createEffect(() => [setC], effectCallback);\nfunction effectCallback([setC]) { setC(() => _untrack(() => _snapshot(x))); }',
    );
  });
});

describe('$deferred', () => {
  it('wraps an alias argument like $memo', () => {
    expectCompiled(
      'const m = $deferred($snapshot(x));',
      'const m = _createDeferred(() => _snapshot(x));',
      'const m = _createDeferred(() => _snapshot(x), { name: "m" });',
    );
  });
});
