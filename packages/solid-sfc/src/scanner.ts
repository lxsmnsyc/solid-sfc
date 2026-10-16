/**
 * A small JavaScript-aware scanner. It does not build an AST. It only finds
 * where an embedded expression ends, while skipping strings, template
 * literals, comments, regular expressions and nested JSX elements.
 */

const OPERAND_KEYWORDS = new Set([
  'await',
  'case',
  'delete',
  'do',
  'else',
  'in',
  'instanceof',
  'new',
  'of',
  'return',
  'throw',
  'typeof',
  'void',
  'yield',
]);

const CLOSING: Record<string, string> = {
  '(': ')',
  '[': ']',
  '{': '}',
};

export function isWhitespace(char: string | undefined): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === '\f';
}

export function isIdentifierStart(char: string | undefined): boolean {
  return char !== undefined && /[A-Za-z_$]/.test(char);
}

export function isIdentifierPart(char: string | undefined): boolean {
  return char !== undefined && /[\w$]/.test(char);
}

export interface ScannerHooks {
  /** Throws an error at the given offset. */
  error(message: string, offset: number): never;
  /**
   * Called when a JSX element starts inside an expression. Returns the
   * offset right after the element.
   */
  element(offset: number): number;
}

export class Scanner {
  readonly source: string;
  private readonly hooks: ScannerHooks;

  constructor(source: string, hooks: ScannerHooks) {
    this.source = source;
    this.hooks = hooks;
  }

  skipWhitespace(offset: number): number {
    let i = offset;
    while (i < this.source.length && isWhitespace(this.source[i])) {
      i++;
    }
    return i;
  }

  /** Skips a quoted string. `offset` points at the opening quote. */
  skipString(offset: number, escapes = true): number {
    const { source } = this;
    const quote = source[offset];
    let i = offset + 1;
    while (i < source.length) {
      const char = source[i];
      if (escapes && char === '\\') {
        i += 2;
      } else if (char === quote) {
        return i + 1;
      } else if (escapes && char === '\n') {
        break;
      } else {
        i++;
      }
    }
    return this.hooks.error('Unterminated string literal', offset);
  }

  /** Skips a template literal. `offset` points at the opening backtick. */
  skipTemplate(offset: number): number {
    const { source } = this;
    let i = offset + 1;
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        i += 2;
      } else if (char === '`') {
        return i + 1;
      } else if (char === '$' && source[i + 1] === '{') {
        i = this.scanExpression(i + 2, '}') + 1;
      } else {
        i++;
      }
    }
    return this.hooks.error('Unterminated template literal', offset);
  }

  /** Skips a regular expression literal. `offset` points at the opening slash. */
  skipRegExp(offset: number): number {
    const { source } = this;
    let i = offset + 1;
    let inClass = false;
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (char === '\n') {
        break;
      }
      if (inClass) {
        if (char === ']') {
          inClass = false;
        }
      } else if (char === '[') {
        inClass = true;
      } else if (char === '/') {
        i++;
        while (isIdentifierPart(source[i])) {
          i++;
        }
        return i;
      }
      i++;
    }
    return this.hooks.error('Unterminated regular expression', offset);
  }

  skipComment(offset: number): number {
    const { source } = this;
    if (source[offset + 1] === '/') {
      const end = source.indexOf('\n', offset);
      return end === -1 ? source.length : end;
    }
    const end = source.indexOf('*/', offset + 2);
    if (end === -1) {
      return this.hooks.error('Unterminated comment', offset);
    }
    return end + 2;
  }

  /**
   * Returns true if the token at `offset` is in a position where an operand
   * is expected. This decides if `/` starts a regular expression and if `<`
   * starts a JSX element.
   */
  private expectsOperand(start: number, offset: number): boolean {
    const { source } = this;
    let i = offset - 1;
    while (i >= start && isWhitespace(source[i])) {
      i--;
    }
    if (i < start) {
      return true;
    }
    const char = source[i]!;
    if (isIdentifierPart(char)) {
      let j = i;
      while (j >= start && isIdentifierPart(source[j])) {
        j--;
      }
      return OPERAND_KEYWORDS.has(source.slice(j + 1, i + 1));
    }
    return !(
      char === ')' ||
      char === ']' ||
      char === '}' ||
      char === '"' ||
      char === "'" ||
      char === '`'
    );
  }

  /**
   * Scans the code of a `<script>` from `offset` and returns the offset of
   * the `</script` that ends it. A `</script` in a string, a template or a
   * comment does not end it.
   */
  scanScript(offset: number): number {
    const { source } = this;
    let i = offset;
    while (i < source.length) {
      const char = source[i]!;
      if (source.startsWith('</script', i)) {
        return i;
      }
      if (char === '"' || char === "'") {
        i = this.skipString(i);
      } else if (char === '`') {
        i = this.skipTemplate(i);
      } else if (char === '/' && (source[i + 1] === '/' || source[i + 1] === '*')) {
        i = this.skipComment(i);
      } else {
        i++;
      }
    }
    return this.hooks.error('Expected </script>', offset);
  }

  /**
   * Scans an expression that starts at `offset` and returns the offset of
   * the unmatched `close` character that ends it. A `;` close ends at the
   * first `;` outside brackets.
   */
  scanExpression(offset: number, close: string): number {
    const { source } = this;
    const stack: string[] = [];
    let i = offset;
    while (i < source.length) {
      const char = source[i]!;
      switch (char) {
        case '"':
        case "'":
          i = this.skipString(i);
          break;
        case '`':
          i = this.skipTemplate(i);
          break;
        case '/':
          if (source[i + 1] === '/' || source[i + 1] === '*') {
            i = this.skipComment(i);
          } else if (this.expectsOperand(offset, i)) {
            i = this.skipRegExp(i);
          } else {
            i++;
          }
          break;
        case '<': {
          const next = source[i + 1];
          if ((next === '>' || isIdentifierStart(next)) && this.expectsOperand(offset, i)) {
            i = this.hooks.element(i);
          } else {
            i++;
          }
          break;
        }
        case '(':
        case '[':
        case '{':
          stack.push(CLOSING[char]!);
          i++;
          break;
        case ')':
        case ']':
        case '}': {
          const expected = stack.pop();
          if (expected === undefined) {
            if (char === close) {
              return i;
            }
            if (close === ';') {
              return this.hooks.error('Expected ";"', i);
            }
            return this.hooks.error(`Unexpected "${char}"`, i);
          }
          if (expected !== char) {
            return this.hooks.error(`Expected "${expected}" but found "${char}"`, i);
          }
          i++;
          break;
        }
        case ';':
          if (close === ';' && stack.length === 0) {
            return i;
          }
          i++;
          break;
        default:
          i++;
      }
    }
    return this.hooks.error(`Expected "${close}"`, offset);
  }
}
