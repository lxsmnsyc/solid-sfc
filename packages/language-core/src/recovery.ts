import { SFCError, compileStructure } from 'solid-sfc';
import type { StructureResult } from 'solid-sfc';

/** Replaces a range with spaces, keeping line breaks, so offsets do not move. */
function blank(source: string, start: number, end: number): string {
  return (
    source.slice(0, start) + source.slice(start, end).replace(/[^\n]/g, ' ') + source.slice(end)
  );
}

const MAX_RECOVERIES = 8;

/**
 * Compiles a file for the editor. If the file has a syntax error, the part
 * with the error is blanked out and the file is compiled again, so the rest
 * of the file still gets type information. The first error is returned
 * together with the result, if there is one.
 */
export function compileForEditor(
  source: string,
  fileName?: string,
): { result: StructureResult | undefined; error: SFCError | undefined } {
  let text = source;
  let first: SFCError | undefined;
  for (let attempt = 0; attempt <= MAX_RECOVERIES; attempt++) {
    try {
      return { result: compileStructure(text, { filename: fileName }), error: first };
    } catch (error) {
      if (!(error instanceof SFCError)) {
        throw error;
      }
      first ??= error;
      let { start, end } = error.recover ?? { start: error.offset, end: error.offset };
      if (!text.slice(start, end).trim()) {
        // Without a hint, or when the hint is already blank, the line goes.
        start = text.lastIndexOf('\n', Math.min(error.offset, text.length) - 1) + 1;
        const lineEnd = text.indexOf('\n', error.offset);
        end = lineEnd === -1 ? text.length : lineEnd;
      }
      if (!text.slice(start, end).trim()) {
        break;
      }
      text = blank(text, start, end);
    }
  }
  return { result: undefined, error: first };
}
