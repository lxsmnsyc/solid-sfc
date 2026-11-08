import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import transform from './util';

function errors(code: string): number {
  return parseSync('out.tsx', code, { lang: 'tsx', sourceType: 'module' }).errors.length;
}

// Runs a compiled body against a minimal createSignal and returns its result.
function run(body: string): unknown {
  const out = transform(`export function run() {\n${body}\n}`);
  const code = out
    .replace(/^import[^\n]*\n/gm, '')
    .replace('export function run', 'return function run');
  const createSignal = (value: number) => {
    let current = value;
    return [
      () => current,
      (next: number | ((prev: number) => number)) => {
        current = typeof next === 'function' ? next(current) : next;
        return current;
      },
    ];
  };
  return new Function('_createSignal', code)(createSignal)();
}

describe('postfix update value', () => {
  it('returns the old value', () => {
    expect(run('let x = $signal(0); const y = x++; return [y, x];')).toEqual([0, 1]);
    expect(run('let x = $signal(0); const y = x--; return [y, x];')).toEqual([0, -1]);
    expect(run('let x = $signal(0); const y = x!++; return [y, x];')).toEqual([0, 1]);
    expect(run('let x = $signal(0); const y = ++x; return [y, x];')).toEqual([1, 1]);
  });
  it('keeps the short form when the value is unused', () => {
    expect(run('let x = $signal(0); x++; x--; x++; return x;')).toBe(1);
    expect(run('let x = $signal(0); for (let i = 0; i < 3; x++, i++) {} return x;')).toBe(3);
    expect(transform('let x = $signal(0);\nx++;')).toMatch(/\((current\w*) => \+\+\1\)/);
  });
});

describe('$signal writes (solid-labels #46)', () => {
  it('compiles wrapped update targets to valid code', () => {
    for (const target of ['x!', '(x as any)', '(x satisfies number)']) {
      const out = transform(`let x = $signal(0);\n${target}++;`);
      expect(errors(out)).toBe(0);
      expect(out).toMatch(/\((current\w*) => \+\+\1\)/);
    }
  });
  it('reports for-of and for-in targets instead of emitting invalid code', () => {
    for (const head of ['x of [1, 2]', 'x in { a: 1 }']) {
      expect(() => transform(`let x = $signal(0);\nfor (${head}) {}`)).toThrow(
        'Unsupported write to reactive variable "x"',
      );
    }
  });
});
