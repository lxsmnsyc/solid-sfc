import { compile } from '../../src/labels/index.ts';
import type { Options } from '../../src/labels/index.ts';

export default function transform(code: string, options?: Options, id = 'test.tsx'): string {
  const result = compile(id, code, options);
  return result.code;
}
