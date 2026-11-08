import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { analyze } from '../../src/labels/scope.ts';
import transform from './util';

interface Ref {
  name: string;
  mode: string;
  bound: boolean;
}

function collect(source: string): Ref[] {
  const parsed = parseSync('test.tsx', source, { lang: 'tsx', sourceType: 'module' });
  const analysis = analyze(parsed.program as never);
  const refs: Ref[] = [];
  for (const binding of analysis.bindings) {
    for (const ref of binding.refs) {
      refs.push({ name: ref.node.name, mode: ref.mode, bound: true });
    }
  }
  for (const ref of analysis.unresolved) {
    refs.push({ name: ref.node.name, mode: ref.mode, bound: false });
  }
  return refs;
}

describe('scope: write targets (solid-labels #46)', () => {
  it('records a for-of head as a write', () => {
    expect(collect('let x; for (x of []) {}')).toEqual([{ name: 'x', mode: 'write', bound: true }]);
  });
  it('records a for-in head as a write', () => {
    expect(collect('let x; for (x in {}) {}')).toEqual([{ name: 'x', mode: 'write', bound: true }]);
  });
  it('records a destructuring for-of head as a write', () => {
    expect(collect('let x; for ([x] of []) {}')).toEqual([
      { name: 'x', mode: 'write', bound: true },
    ]);
  });
  it('records a non-null update target as readwrite', () => {
    expect(collect('let x = 0; x!++;')).toEqual([{ name: 'x', mode: 'readwrite', bound: true }]);
  });
});

describe('scope: names and defaults (solid-labels #47, #49)', () => {
  it('keeps the inner name of a class expression local', () => {
    const code = 'const o = class $signal { m(){ return $signal; } };';
    expect(transform(code)).toBe(code);
  });
  it('binds a class expression name for a JSX name', () => {
    const out = transform('const o = class Show { m(){ return <Show />; } };');
    expect(out).not.toContain('solid-js');
  });
  it('resolves a parameter default outside the body var', () => {
    expect(() => transform('function f(x = $signal(1)) { var $signal = 1; }')).toThrow(
      '$signal must initialize a variable declaration',
    );
  });
  it('still lets the body see its own var', () => {
    const code = 'function f(x = 1) { var $signal = 1; return $signal; }';
    expect(transform(code)).toBe(code);
  });
  it('binds a function expression name to a same-named parameter', () => {
    const code = '(function $signal($signal) { return $signal; });';
    expect(transform(code)).toBe(code);
  });
});

describe('scope: decorators and TypeScript positions (solid-labels #48)', () => {
  it('records a reference in a class decorator', () => {
    expect(collect('const d = 1; @d class C {}')).toEqual([
      { name: 'd', mode: 'read', bound: true },
    ]);
  });
  it('records a write in a namespace body', () => {
    expect(collect('let a = 1; namespace N { a = 2 }')).toEqual([
      { name: 'a', mode: 'write', bound: true },
    ]);
  });
  it('records a reference in an enum initializer', () => {
    expect(collect('enum E { A = 2, B = A }')).toEqual([{ name: 'A', mode: 'read', bound: true }]);
  });
  it('declares a parameter property', () => {
    expect(collect('class C { constructor(private p) { p } }')).toEqual([
      { name: 'p', mode: 'read', bound: true },
    ]);
  });
  it('declares an import equals binding', () => {
    expect(collect('import fs = require("fs"); fs.x')).toEqual([
      { name: 'fs', mode: 'read', bound: true },
    ]);
  });
});
