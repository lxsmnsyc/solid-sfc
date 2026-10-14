import type MagicString from 'magic-string';
import { Scanner, isWhitespace } from './scanner.ts';

export interface Block {
  type: 'script' | 'style';
  attributes: Record<string, string | true>;
  /** Offset of the opening `<`. */
  start: number;
  /** Offset right after the closing tag. */
  end: number;
  contentStart: number;
  contentEnd: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface TemplateResult {
  blocks: Block[];
  /** The parts of the file that are markup, in source order. */
  markup: Range[];
}

// HTML elements that never have children. They may be written without `/>`.
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);

const TAG_NAME = /[A-Za-z_$][\w$.:-]*/y;
const ATTRIBUTE_NAME = /[A-Za-z_$][\w$-]*(?::[A-Za-z_$][\w$-]*)?/y;
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const BARE_VALUE = /[\w$.]+/y;
const BLOCK_ATTRIBUTE = /([A-Za-z_$][\w$:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;

function matchAt(pattern: RegExp, source: string, offset: number): string | undefined {
  pattern.lastIndex = offset;
  return pattern.exec(source)?.[0];
}

/** Where an attribute value ends up in the output. */
type ValueContext = 'attribute' | 'expression';

/**
 * Parses the markup of a component and rewrites the JSX superset syntax into
 * plain JSX, in place, on `output`. `<script>` and `<style>` blocks at the
 * top level are collected and left untouched.
 */
export class TemplateParser {
  private readonly source: string;
  private readonly output: MagicString;
  private readonly scanner: Scanner;
  private readonly fail: (message: string, offset: number) => never;

  constructor(
    source: string,
    output: MagicString,
    fail: (message: string, offset: number) => never,
  ) {
    this.source = source;
    this.output = output;
    this.fail = fail;
    this.scanner = new Scanner(source, {
      error: fail,
      element: (offset) => this.parseElement(offset),
    });
  }

  parse(): TemplateResult {
    const blocks: Block[] = [];
    this.parseChildren(0, blocks);

    const markup: Range[] = [];
    let start = 0;
    for (const block of blocks) {
      if (block.start > start) {
        markup.push({ start, end: block.start });
      }
      start = block.end;
    }
    if (start < this.source.length) {
      markup.push({ start, end: this.source.length });
    }
    return { blocks, markup };
  }

  /**
   * Parses element children until a closing tag or the end of the file.
   * Top-level blocks are only collected when `blocks` is given. Returns the
   * offset of the closing tag.
   */
  private parseChildren(offset: number, blocks?: Block[]): number {
    const { source } = this;
    let i = offset;
    while (i < source.length) {
      const char = source[i];
      if (char === '<') {
        if (source.startsWith('<!--', i)) {
          i = this.removeComment(i);
        } else if (source[i + 1] === '/') {
          if (blocks) {
            this.fail('Unexpected closing tag', i);
          }
          return i;
        } else if (blocks && /^<(script|style)[\s>]/.test(source.slice(i, i + 8))) {
          const block = this.parseBlock(i);
          blocks.push(block);
          i = block.end;
        } else {
          i = this.parseElement(i);
        }
      } else if (char === '{') {
        i = this.scanner.scanExpression(i + 1, '}') + 1;
      } else {
        i++;
      }
    }
    if (!blocks) {
      this.fail('Unexpected end of file, expected a closing tag', i);
    }
    return i;
  }

  private removeComment(offset: number): number {
    const end = this.source.indexOf('-->', offset + 4);
    if (end === -1) {
      this.fail('Unterminated comment', offset);
    }
    this.output.remove(offset, end + 3);
    return end + 3;
  }

  private parseBlock(offset: number): Block {
    const { source } = this;
    const type = source.startsWith('<script', offset) ? 'script' : 'style';
    const attributes: Record<string, string | true> = {};
    let i = offset + type.length + 1;
    while (true) {
      i = this.scanner.skipWhitespace(i);
      if (source[i] === '>') {
        break;
      }
      BLOCK_ATTRIBUTE.lastIndex = i;
      const match = BLOCK_ATTRIBUTE.exec(source);
      if (!match) {
        this.fail(`Invalid <${type}> attribute`, i);
      }
      attributes[match[1]!] = match[2] ?? match[3] ?? true;
      i += match[0].length;
    }
    const contentStart = i + 1;
    const contentEnd = source.indexOf(`</${type}`, contentStart);
    if (contentEnd === -1) {
      this.fail(`Missing </${type}>`, offset);
    }
    const end = source.indexOf('>', contentEnd);
    if (end === -1) {
      this.fail(`Missing </${type}>`, offset);
    }
    return { type, attributes, start: offset, end: end + 1, contentStart, contentEnd };
  }

  /** Parses an element or fragment at `offset` and returns the offset after it. */
  private parseElement(offset: number): number {
    const { source } = this;
    if (source[offset + 1] === '>') {
      const close = this.parseChildren(offset + 2);
      return this.parseClosingTag(close, '');
    }
    const name = matchAt(TAG_NAME, source, offset + 1);
    if (!name) {
      return this.fail('Expected a tag name', offset + 1);
    }
    const { end, selfClosing } = this.parseAttributes(offset + 1 + name.length);
    if (selfClosing) {
      return end;
    }
    if (VOID_ELEMENTS.has(name)) {
      this.output.appendLeft(end - 1, '/');
      return end;
    }
    const close = this.parseChildren(end);
    return this.parseClosingTag(close, name);
  }

  private parseClosingTag(offset: number, name: string): number {
    const { source } = this;
    let i = this.scanner.skipWhitespace(offset + 2);
    const closing = matchAt(TAG_NAME, source, i) ?? '';
    if (closing !== name) {
      this.fail(name ? `Expected </${name}>` : 'Expected </>', offset);
    }
    i = this.scanner.skipWhitespace(i + closing.length);
    if (source[i] !== '>') {
      this.fail('Expected ">"', i);
    }
    return i + 1;
  }

  private parseAttributes(offset: number): { end: number; selfClosing: boolean } {
    const { source, output } = this;
    let i = offset;
    while (true) {
      const start = this.scanner.skipWhitespace(i);
      if (start === i && i !== offset && !'/>'.includes(source[i] ?? '')) {
        this.fail('Expected whitespace between attributes', i);
      }
      i = start;
      const char = source[i];
      if (char === undefined) {
        this.fail('Unexpected end of file inside a tag', offset);
      }
      if (char === '/' && source[i + 1] === '>') {
        return { end: i + 2, selfClosing: true };
      }
      if (char === '>') {
        return { end: i + 1, selfClosing: false };
      }
      if (char === '{') {
        // `{...spread}` is kept, `{name}` becomes `name={name}`.
        const close = this.scanner.scanExpression(i + 1, '}');
        const inner = source.slice(i + 1, close).trim();
        if (IDENTIFIER.test(inner)) {
          output.appendLeft(i, `${inner}=`);
        } else if (!inner.startsWith('...')) {
          this.fail('Expected a spread or a shorthand attribute', i);
        }
        i = close + 1;
      } else if (char === '(') {
        // `(name)` becomes `name={name}`.
        const close = this.scanner.scanExpression(i + 1, ')');
        const inner = source.slice(i + 1, close).trim();
        if (!IDENTIFIER.test(inner)) {
          this.fail('Expected an identifier', i + 1);
        }
        output.update(i, i + 1, `${inner}={`);
        output.update(close, close + 1, '}');
        i = close + 1;
      } else if (char === '[') {
        // `[name]=value` becomes `{...{ [name]: value }}`.
        const close = this.scanner.scanExpression(i + 1, ']');
        output.update(i, i + 1, '{...{[');
        const equals = this.scanner.skipWhitespace(close + 1);
        if (source[equals] === '=') {
          const valueStart = this.scanner.skipWhitespace(equals + 1);
          output.update(close, valueStart, ']: ');
          i = this.parseValue(valueStart, 'expression');
          output.appendLeft(i, '}}');
        } else {
          output.update(close, close + 1, ']: true}}');
          i = close + 1;
        }
      } else {
        const name = matchAt(ATTRIBUTE_NAME, source, i);
        if (!name) {
          return this.fail(`Unexpected "${char}" inside a tag`, i);
        }
        const nameEnd = i + name.length;
        const equals = this.scanner.skipWhitespace(nameEnd);
        if (source[equals] === '=') {
          i = this.parseValue(this.scanner.skipWhitespace(equals + 1), 'attribute');
        } else {
          i = nameEnd;
        }
      }
    }
  }

  /**
   * Parses an attribute value and returns the offset after it. In an
   * `attribute` context the value is rewritten into a valid JSX attribute
   * value. In an `expression` context it is rewritten into a JS expression.
   */
  private parseValue(offset: number, context: ValueContext): number {
    const { source, scanner } = this;
    const char = source[offset];
    let end: number;
    let wrap = context === 'attribute';
    switch (char) {
      case '"':
      case "'":
        // JSX strings have no escapes. JS strings do.
        end = scanner.skipString(offset, context === 'expression');
        wrap = false;
        break;
      case '`':
        end = scanner.skipTemplate(offset);
        break;
      case '{': {
        // Braces hold an object literal.
        end = scanner.scanExpression(offset + 1, '}') + 1;
        if (context === 'expression') {
          this.output.appendLeft(offset, '(');
          this.output.appendLeft(end, ')');
        }
        break;
      }
      case '(':
        end = scanner.scanExpression(offset + 1, ')') + 1;
        break;
      case '[':
        end = scanner.scanExpression(offset + 1, ']') + 1;
        break;
      case '/':
        end = scanner.skipRegExp(offset);
        break;
      case '<':
        end = this.parseElement(offset);
        wrap = false;
        break;
      default: {
        const value = matchAt(BARE_VALUE, source, offset);
        if (!value) {
          return this.fail('Expected an attribute value', offset);
        }
        end = offset + value.length;
        const next = source[end];
        if (next !== undefined && !isWhitespace(next) && next !== '>' && next !== '/') {
          this.fail('Wrap this attribute value in parentheses', offset);
        }
      }
    }
    if (wrap) {
      this.output.appendLeft(offset, '{');
      this.output.appendLeft(end, '}');
    }
    return end;
  }
}
