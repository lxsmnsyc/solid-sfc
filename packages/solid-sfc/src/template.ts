import type MagicString from 'magic-string';
import { ControlFlowParser } from './control.ts';
import type { GeneratedProp } from './control.ts';
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
  /** True if a `style` attribute is merged with the CSS variables. */
  mergesStyle: boolean;
  /** True if a `#key` block is used. */
  usesKey: boolean;
  /** Props that control flow blocks generate. */
  props: GeneratedProp[];
}

/** Where children are parsed. Each mode ends at a different token. */
type ChildrenMode = 'root' | 'element' | 'block';

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

/** Scoping applied to native elements when the component has scoped styles. */
export interface TemplateScope {
  /** Attribute added to every native element. */
  attribute: string;
  /** Function that returns the CSS variables, if the styles have any. */
  variables: string | undefined;
  /** Helper that merges a `style` value with the CSS variables. */
  mergeStyle: string;
}

// Lowercase tags are native elements. Components and namespaced tags are not.
const NATIVE_ELEMENT = /^[a-z][\w-]*$/;

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
  private readonly scope: TemplateScope | undefined;
  private readonly control: ControlFlowParser;
  private mergesStyle = false;

  constructor(
    source: string,
    output: MagicString,
    fail: (message: string, offset: number) => never,
    scope?: TemplateScope,
  ) {
    this.source = source;
    this.output = output;
    this.fail = fail;
    this.scope = scope;
    this.scanner = new Scanner(source, {
      error: fail,
      element: (offset) => this.parseElement(offset),
    });
    this.control = new ControlFlowParser({
      source,
      output,
      scanner: this.scanner,
      fail,
      parseBody: (offset) => this.parseChildren(offset, 'block'),
    });
  }

  parse(): TemplateResult {
    const blocks: Block[] = [];
    this.parseChildren(0, 'root', blocks);

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
    return {
      blocks,
      markup,
      mergesStyle: this.mergesStyle,
      usesKey: this.control.usesKey,
      props: this.control.props,
    };
  }

  /**
   * Parses children until the token that ends `mode`: the end of the file
   * for `root`, a closing tag for `element`, and `}` for a control flow
   * `block`. Top-level `<script>` and `<style>` blocks are collected into
   * `blocks`. Returns the offset of the ending token.
   */
  private parseChildren(offset: number, mode: ChildrenMode, blocks?: Block[]): number {
    const { source } = this;
    let i = offset;
    while (i < source.length) {
      const char = source[i];
      if (char === '<') {
        if (source.startsWith('<!--', i)) {
          i = this.removeComment(i);
        } else if (source[i + 1] === '/') {
          if (mode !== 'element') {
            this.fail(
              mode === 'block' ? 'Expected "}" to close the block' : 'Unexpected closing tag',
              i,
            );
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
      } else if (char === '}' && mode === 'block') {
        return i;
      } else if (char === '#') {
        const keyword = this.control.match(i);
        i = keyword ? this.control.parse(keyword) : i + 1;
      } else {
        i++;
      }
    }
    if (mode === 'element') {
      this.fail('Unexpected end of file, expected a closing tag', i);
    }
    if (mode === 'block') {
      this.fail('Expected "}" to close the block', i);
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
      const close = this.parseChildren(offset + 2, 'element');
      return this.parseClosingTag(close, '');
    }
    const name = matchAt(TAG_NAME, source, offset + 1);
    if (!name) {
      return this.fail('Expected a tag name', offset + 1);
    }
    const nameEnd = offset + 1 + name.length;
    const scope = this.scope && NATIVE_ELEMENT.test(name) ? this.scope : undefined;
    if (scope) {
      this.output.appendLeft(nameEnd, ` ${scope.attribute}`);
    }
    const { end, attributesEnd, selfClosing, hasStyle } = this.parseAttributes(nameEnd, scope);
    if (scope?.variables && !hasStyle) {
      this.output.appendLeft(attributesEnd, ` style={${scope.variables}()}`);
    }
    if (selfClosing) {
      return end;
    }
    if (VOID_ELEMENTS.has(name)) {
      this.output.appendLeft(end - 1, '/');
      return end;
    }
    const close = this.parseChildren(end, 'element');
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

  private parseAttributes(
    offset: number,
    scope: TemplateScope | undefined,
  ): { end: number; attributesEnd: number; selfClosing: boolean; hasStyle: boolean } {
    const { source, output } = this;
    // The CSS variables are merged into the `style` attribute, if any.
    const variables = scope?.variables;
    const mergedStyle = `style={${scope?.mergeStyle}(style, ${variables}())}`;
    let hasStyle = false;
    let i = offset;
    while (true) {
      const attributesEnd = i;
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
        return { end: i + 2, attributesEnd, selfClosing: true, hasStyle };
      }
      if (char === '>') {
        return { end: i + 1, attributesEnd, selfClosing: false, hasStyle };
      }
      if (char === '{') {
        // `{...spread}` is kept, `{name}` becomes `name={name}`.
        const close = this.scanner.scanExpression(i + 1, '}');
        const inner = source.slice(i + 1, close).trim();
        if (variables && inner === 'style') {
          output.update(i, close + 1, mergedStyle);
          hasStyle = true;
          this.mergesStyle = true;
        } else if (IDENTIFIER.test(inner)) {
          // The scope attribute may end right before this one.
          output.appendLeft(i, `${start === offset ? ' ' : ''}${inner}=`);
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
        if (variables && inner === 'style') {
          output.update(i, close + 1, mergedStyle);
          hasStyle = true;
          this.mergesStyle = true;
        } else {
          output.update(i, i + 1, `${inner}={`);
          output.update(close, close + 1, '}');
        }
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
        if (source[equals] === '=' && variables && name === 'style') {
          const valueStart = this.scanner.skipWhitespace(equals + 1);
          output.appendLeft(valueStart, `{${scope.mergeStyle}(`);
          i = this.parseValue(valueStart, 'expression');
          output.appendLeft(i, `, ${variables}())}`);
          hasStyle = true;
          this.mergesStyle = true;
        } else if (source[equals] === '=') {
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
