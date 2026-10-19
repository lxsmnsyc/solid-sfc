// Vendored from solid-labels 1.0 (https://github.com/lxsmnsyc/solid-labels/pull/30), MIT license.
// Local changes:
// - Removing and extracting text uses `overwrite` and `slice`, which behave
//   the same in magic-string 1.2 and 1.4.
// - Arrow functions around object literals get parentheses.
// - Relative imports use `.ts` extensions.
import MagicString from 'magic-string';
import { parseSync } from 'oxc-parser';
import { Ctx } from './context.ts';
import { CompileError } from './errors.ts';
import { analyze } from './scope.ts';
import transformProgram from './transform.ts';
import type { CompileOutput, Options } from './types.ts';

export type { CompileOutput, Options };
export { CompileError };

/** Infers the parser language from the file extension (query suffix ignored). */
const TSX_FILE = /\.tsx$/i;
const TS_FILE = /\.[mc]?ts$/i;

function languageOf(filename: string): 'js' | 'jsx' | 'ts' | 'tsx' {
  const clean = filename.split('?')[0];
  if (TSX_FILE.test(clean)) {
    return 'tsx';
  }
  if (TS_FILE.test(clean)) {
    return 'ts';
  }
  return 'jsx';
}

/**
 * Compiles a module: parse with oxc, analyze scopes (`analyze`), apply all
 * transforms (`transformProgram`) as span edits over a MagicString, and
 * return the code plus a hires source map.
 */
export function compile(id: string, code: string, options: Options = {}): CompileOutput {
  const result = parseSync(id.split('?')[0], code, {
    lang: languageOf(id),
    sourceType: 'module',
    preserveParens: false,
  });
  if (result.errors.length > 0) {
    const first = result.errors[0];
    const start = first.labels?.[0]?.start ?? 0;
    throw new CompileError(first.message, code, start);
  }
  const s = new MagicString(code);
  const analysis = analyze(result.program);
  const ctx = new Ctx(s, code, analysis, options.dev === true, options.disabled?.ctf ?? {});
  transformProgram(ctx);
  return {
    code: s.toString(),
    map: s.generateMap({ source: id, hires: true }),
  };
}
