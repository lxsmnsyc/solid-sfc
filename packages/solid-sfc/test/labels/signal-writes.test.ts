import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import transform from './util';

function errors(code: string): number {
  return parseSync('out.tsx', code, { lang: 'tsx', sourceType: 'module' }).errors.length;
}

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
