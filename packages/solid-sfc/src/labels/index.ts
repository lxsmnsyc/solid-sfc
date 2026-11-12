// Vendored from solid-labels (https://github.com/lxsmnsyc/solid-labels), MIT license.
// Local changes:
// - Relative imports use `.ts` extensions.
// - `compile` always returns a `CompileOutput`: solid-sfc compiles generated
//   TSX and expects output, so there is no `NEEDS_COMPILE` check and no
//   `null` result when nothing changed.
// - The source map has no `includeContent`.
// - Generated parameter names (`current`, `param`) and setter names
//   (`setCount`) keep the plain form; imports are grouped by module with
//   single quotes (see `context.ts`, `variables.ts`).
// - `$refresh(x)` passes the accessor and does not make an effect track `x`.
// - `registry.ts` has no control flow namespace components, and `$isPending`
//   and `$latest` are arrow CTFs.
import MagicString from 'magic-string';
import * as oxc from 'oxc-parser';
import type { ParserOptions } from 'oxc-parser';
import { Ctx } from './context.ts';
import { CompileError } from './errors.ts';
import { analyze } from './scope.ts';
import transformProgram from './transform.ts';
import type { CompileOutput, Options } from './types.ts';

// oxc-parser 0.157 does not type this option. Raw transfer is oxc's faster
// parse path (https://github.com/oxc-project/oxc/issues/28275). After an oxc
// minor bump, re-run `benchmarks/compile` and check the oxc changelog for raw
// transfer: a rename makes parsing fall back to the slow path without an error.
// The value must be `rawTransferSupported()`: `true` throws on platforms
// without support.
// The browser build of oxc-parser (wasm) has no `rawTransferSupported` export,
// so the function is read from the namespace and a missing one means "off".
const { parseSync } = oxc;
const PARSE_OPTIONS: ParserOptions & { experimentalRawTransfer?: boolean } = {
  experimentalRawTransfer: 'rawTransferSupported' in oxc && oxc.rawTransferSupported(),
};

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
  // Bundlers can add a query to the id. The parser and the source map need
  // the file path without it.
  const filename = id.split('?')[0];
  const result = parseSync(filename, code, {
    lang: languageOf(id),
    sourceType: 'module',
    preserveParens: false,
    ...PARSE_OPTIONS,
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
    map: s.generateMap({ source: filename, hires: true }),
  };
}
