export interface SourceLocation {
  line: number;
  column: number;
}

export function getLocation(source: string, offset: number): SourceLocation {
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < offset && i < source.length; i++) {
    if (source[i] === '\n') {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, column: offset - lineStart + 1 };
}

export class SFCError extends Error {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
  readonly filename: string | undefined;

  constructor(message: string, source: string, offset: number, filename?: string) {
    const { line, column } = getLocation(source, offset);
    super(`${message} (${filename ?? '<anonymous>'}:${line}:${column})`);
    this.name = 'SFCError';
    this.offset = offset;
    this.line = line;
    this.column = column;
    this.filename = filename;
  }
}

/** A problem that does not stop compiling, such as an unused CSS selector. */
export interface SFCWarning {
  /** Identifies the kind of warning, such as `a11y-missing-alt`. */
  code: string;
  message: string;
  offset: number;
  /** The length of the text the warning is about. */
  length: number;
  line: number;
  column: number;
}

export function createWarning(
  code: string,
  message: string,
  source: string,
  offset: number,
  length: number,
): SFCWarning {
  return { code, message, offset, length, ...getLocation(source, offset) };
}
