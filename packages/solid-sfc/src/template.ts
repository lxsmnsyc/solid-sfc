import type MagicString from 'magic-string';
import { ControlFlowParser } from './control.ts';
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

/**
 * Text that the compiler writes into the output for a range of the source,
 * such as the copy of `name` in the handler of `bind:value=name`. Type errors
 * on the text are reported on the range.
 */
export interface GeneratedText {
  text: string;
  /** A source offset whose character is copied into the output. */
  anchor: number;
  /** Where the text starts, relative to the copied anchor character. */
  delta: number;
  start: number;
  end: number;
}

/** How `bind:` attributes read and listen to each property. */
const BINDINGS: Record<string, { tags: string[]; event: string }> = {
  value: { tags: ['input', 'textarea', 'select'], event: 'onInput' },
  checked: { tags: ['input'], event: 'onChange' },
};

// A `bind:` target is a name, followed by property accesses and indexes.
// The keys of an object literal: `name:`, `'name':`, `"name":` or a shorthand `name`.
const OBJECT_KEY = /(?:^|,)\s*(?:([A-Za-z_$][\w$-]*)|'([^']*)'|"([^"]*)")\s*(?=[:,]|$)/g;

const BIND_TARGET = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\[[^\]]*\])*$/;

interface Binding {
  property: string;
  /** Offset of `bind:`. */
  start: number;
  valueStart: number;
  valueEnd: number;
}

export interface TemplateResult {
  blocks: Block[];
  /** The parts of the file that are markup, in source order. */
  markup: Range[];
  /** True if a `style` attribute is merged with the CSS variables. */
  mergesStyle: boolean;
  /** True if a `#key` block is used. */
  usesKey: boolean;
  /** True if `<solid:window>` or `<solid:document>` is used. */
  usesListen: boolean;
  /** Text that the compiler generates for parts of the source. */
  generated: GeneratedText[];
  /** The bodies of control flow blocks, from `{` to `}`. */
  bodies: Range[];
  /** `#template` declarations at the top level, which go before the markup. */
  templates: Range[];
  /** The native elements of the markup, to find CSS selectors that match nothing. */
  elements: ElementInfo[];
}

/** A native element, for unused CSS selectors and accessibility checks. */
export interface ElementInfo {
  tag: string;
  /** Offset of `<`. */
  offset: number;
  /**
   * The attributes of the element: a string for a literal value, `true`
   * without a value, and `null` for an expression.
   */
  attributes: Map<string, string | true | null>;
  /** True if the element has a spread, so it can have any attribute. */
  spread: boolean;
  /** Warning codes that a `<!-- solid-sfc-ignore code -->` comment turns off. */
  ignores: Set<string>;
  classes: Set<string>;
  ids: Set<string>;
  /** True if a class or an id is set by an expression or a spread. */
  dynamicClass: boolean;
  dynamicId: boolean;
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
const MEMBER_NAME = /#?[A-Za-z_$][\w$]*/y;
const PREFIX_OPERATORS = '!-+~';
const BLOCK_ATTRIBUTE = /([A-Za-z_$][\w$:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'))?/y;

/** The value of a string, number or boolean literal, or null for an expression. */
function literalValue(value: string): string | null {
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length > 1) {
    return value.slice(1, -1);
  }
  return /^(?:-?\d+(?:\.\d+)?|true|false)$/.test(value) ? value : null;
}

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

// The `solid:` elements. Solid components that a control flow block replaces
// are not elements, so `<solid:for>` points to `#for`.
const SOLID_ELEMENTS = new Set([
  'window',
  'document',
  'dynamic',
  'hydration',
  'hydration-script',
  'no-hydration',
]);
const REPLACED_ELEMENTS: Record<string, string> = {
  for: '#for',
  show: '#if',
  switch: '#switch',
  match: '#case',
  repeat: '#repeat',
  errored: '#try',
  loading: '#loading',
  reveal: '#reveal',
  portal: '#portal',
};

/** Helper from `solid-sfc/runtime` used by `<solid:window>` and `<solid:document>`. */
export const LISTEN_IDENTIFIER = '__listen';

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
  private usesListen = false;
  private readonly elements: ElementInfo[] = [];
  /** The codes of the last `solid-sfc-ignore` comment, and where it ends. */
  private ignore: { codes: Set<string>; end: number } | undefined;
  private readonly generated: GeneratedText[] = [];

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

    // Scripts, styles and top-level templates are not part of the markup.
    const excluded = [...blocks, ...this.control.templates].toSorted((a, b) => a.start - b.start);
    const markup: Range[] = [];
    let start = 0;
    for (const range of excluded) {
      if (range.start > start) {
        markup.push({ start, end: range.start });
      }
      start = range.end;
    }
    if (start < this.source.length) {
      markup.push({ start, end: this.source.length });
    }
    return {
      blocks,
      markup,
      mergesStyle: this.mergesStyle,
      usesKey: this.control.usesKey,
      usesListen: this.usesListen,
      generated: [
        // A generated prop is written as `name={` right before its value.
        ...this.control.props.map((prop) => ({
          text: prop.name,
          anchor: prop.start,
          delta: -(prop.name.length + 2),
          start: prop.start,
          end: prop.end,
        })),
        ...this.generated,
      ],
      bodies: this.control.bodies,
      templates: this.control.templates,
      elements: this.elements,
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
        if (keyword?.name === 'const' && mode !== 'block') {
          this.fail('#const must be directly inside a block', i);
        }
        if (keyword?.name === 'template' && mode === 'element') {
          this.fail('#template must be at the top level or directly inside a block', i);
        }
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
    const match = /^\s*solid-sfc-ignore\s+([\s\S]*?)\s*$/.exec(this.source.slice(offset + 4, end));
    if (match) {
      this.ignore = { codes: new Set(match[1]!.split(/[\s,]+/)), end: end + 3 };
    }
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
    if (name === 'solid:window' || name === 'solid:document') {
      return this.parseListeners(offset, nameEnd, name.slice(6) as 'window' | 'document');
    }
    if (name.startsWith('solid:') && !SOLID_ELEMENTS.has(name.slice(6))) {
      const block = REPLACED_ELEMENTS[name.slice(6)];
      this.fail(
        block ? `Use ${block} instead of <${name}>` : `Unknown element <${name}>`,
        offset + 1,
      );
    }
    const native = NATIVE_ELEMENT.test(name);
    const scope = this.scope && native ? this.scope : undefined;
    // An ignore comment applies to the element right after it.
    const ignores =
      this.ignore && this.scanner.skipWhitespace(this.ignore.end) === offset
        ? this.ignore.codes
        : new Set<string>();
    const element: ElementInfo = {
      tag: name.toLowerCase(),
      offset,
      attributes: new Map(),
      spread: false,
      ignores,
      classes: new Set(),
      ids: new Set(),
      dynamicClass: false,
      dynamicId: false,
    };
    if (native) {
      this.elements.push(element);
    }
    if (scope) {
      this.output.appendLeft(nameEnd, ` ${scope.attribute}`);
    }
    const { end, attributesEnd, selfClosing, hasStyle } = this.parseAttributes(
      nameEnd,
      name,
      scope,
      element,
    );
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

  /**
   * `<solid:window onKeyDown=close />` becomes
   * `{__listen('window', 'keydown', close)}`, which adds the listener until
   * the component or its block is removed.
   */
  private parseListeners(offset: number, nameEnd: number, target: 'window' | 'document'): number {
    const { source, output, scanner } = this;
    const tag = `<solid:${target}>`;
    this.usesListen = true;
    let previous = offset;
    let i = nameEnd;
    while (true) {
      const start = scanner.skipWhitespace(i);
      if (source.startsWith('/>', start)) {
        output.remove(previous, start + 2);
        return start + 2;
      }
      if (source[start] === '>') {
        return this.fail(`${tag} must end with "/>"`, start);
      }
      const name = matchAt(ATTRIBUTE_NAME, source, start);
      if (!name || !/^on[A-Z]/.test(name)) {
        return this.fail(`${tag} only takes event handlers, such as onKeyDown`, start);
      }
      const equals = scanner.skipWhitespace(start + name.length);
      if (source[equals] !== '=') {
        return this.fail(`Expected a value for ${name}`, start);
      }
      const valueStart = scanner.skipWhitespace(equals + 1);
      i = this.parseValue(valueStart, 'expression');
      const event = `'${name.slice(2).toLowerCase()}'`;
      output.update(previous, valueStart, `{${LISTEN_IDENTIFIER}('${target}', ${event}, `);
      output.appendLeft(i, ')}');
      // An unknown event is reported on the attribute name.
      this.generated.push({
        text: event,
        anchor: valueStart,
        delta: -(event.length + 2),
        start,
        end: start + name.length,
      });
      previous = i;
    }
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
    tag: string,
    scope: TemplateScope | undefined,
    element: ElementInfo,
  ): { end: number; attributesEnd: number; selfClosing: boolean; hasStyle: boolean } {
    const { source, output } = this;
    const names = new Set<string>();
    const bindings: Binding[] = [];
    let type: string | undefined;
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
        this.applyBindings(tag, bindings, names, type);
        return { end: i + 2, attributesEnd, selfClosing: true, hasStyle };
      }
      if (char === '>') {
        this.applyBindings(tag, bindings, names, type);
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
          element.attributes.set(inner, null);
          this.collectSelectorValue(element, inner, inner);
          // The scope attribute may end right before this one.
          output.appendLeft(i, `${start === offset ? ' ' : ''}${inner}=`);
        } else if (inner.startsWith('...')) {
          element.spread = true;
          element.dynamicClass = true;
          element.dynamicId = true;
        } else {
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
          element.attributes.set(inner, null);
          this.collectSelectorValue(element, inner, inner);
          output.update(i, i + 1, `${inner}={`);
          output.update(close, close + 1, '}');
        }
        i = close + 1;
      } else if (char === '[') {
        // `[name]=value` becomes `{...{ [name]: value }}`.
        element.spread = true;
        element.dynamicClass = true;
        element.dynamicId = true;
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
        names.add(name);
        if (name.startsWith('bind:')) {
          if (source[equals] !== '=') {
            this.fail(`Expected a value for ${name}`, i);
          }
          const valueStart = this.scanner.skipWhitespace(equals + 1);
          const valueEnd = this.parseValue(valueStart, 'attribute');
          bindings.push({ property: name.slice(5), start: i, valueStart, valueEnd });
          element.attributes.set(name.slice(5), null);
          i = valueEnd;
        } else if (source[equals] === '=' && variables && name === 'style') {
          const valueStart = this.scanner.skipWhitespace(equals + 1);
          output.appendLeft(valueStart, `{${scope.mergeStyle}(`);
          i = this.parseValue(valueStart, 'expression');
          output.appendLeft(i, `, ${variables}())}`);
          element.attributes.set(name, null);
          hasStyle = true;
          this.mergesStyle = true;
        } else if (source[equals] === '=') {
          const valueStart = this.scanner.skipWhitespace(equals + 1);
          i = this.parseValue(valueStart, 'attribute');
          if (name === 'type' && '"\''.includes(source[valueStart]!)) {
            type = source.slice(valueStart + 1, i - 1);
          }
          if (name === 'class' || name === 'id') {
            this.collectSelectorValue(element, name, source.slice(valueStart, i));
          }
          element.attributes.set(name, literalValue(source.slice(valueStart, i)));
        } else {
          element.attributes.set(name, true);
          i = nameEnd;
        }
      }
    }
  }

  /**
   * Records the classes or the id that a `class` or `id` value sets. Strings
   * and the keys of object literals are known. Other values are dynamic.
   */
  private collectSelectorValue(element: ElementInfo, name: string, value: string): void {
    if (name !== 'class' && name !== 'id') {
      return;
    }
    const names = name === 'class' ? element.classes : element.ids;
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      for (const item of value.slice(1, -1).split(/\s+/)) {
        if (item) {
          names.add(item);
        }
      }
      return;
    }
    if (name === 'class' && value.startsWith('{')) {
      // `class={ active: on, 'is-open': open }` can set its keys.
      const keys = [...value.slice(1, -1).matchAll(OBJECT_KEY)];
      if (keys.length > 0 && !value.includes('...') && !value.includes('[')) {
        for (const key of keys) {
          names.add(key[1] ?? key[2] ?? key[3]!);
        }
        return;
      }
    }
    if (name === 'class') {
      element.dynamicClass = true;
    } else {
      element.dynamicId = true;
    }
  }

  /**
   * `bind:value=name` becomes `value={name}` and a handler that writes the
   * new value back, such as `onInput={(event) => (name = event.currentTarget.value)}`.
   */
  private applyBindings(
    tag: string,
    bindings: Binding[],
    names: Set<string>,
    type: string | undefined,
  ): void {
    const { source, output } = this;
    for (const binding of bindings) {
      const name = `bind:${binding.property}`;
      const config = BINDINGS[binding.property];
      if (!config || !config.tags.includes(tag)) {
        this.fail(`${name} is not supported on <${tag}>`, binding.start);
      }
      if (names.has(config.event)) {
        this.fail(
          `${name} sets ${config.event}, so the element cannot have its own`,
          binding.start,
        );
      }
      const target = source.slice(binding.valueStart, binding.valueEnd);
      if (!BIND_TARGET.test(target)) {
        this.fail(`${name} needs a variable or a property`, binding.valueStart);
      }
      const property =
        binding.property === 'value' && (type === 'number' || type === 'range')
          ? 'valueAsNumber'
          : binding.property;
      // `bind:` is removed, so the property name keeps its place in the source.
      output.remove(binding.start, binding.start + 5);
      const prefix = ` ${config.event}={(event) => (`;
      output.appendLeft(binding.valueEnd, `${prefix}${target} = event.currentTarget.${property})}`);
      // The copy of the target follows the last character of the value and
      // the `}` that closes it.
      this.generated.push({
        text: target,
        anchor: binding.valueEnd - 1,
        delta: 2 + prefix.length,
        start: binding.valueStart,
        end: binding.valueEnd,
      });
    }
  }

  /**
   * Parses an attribute value and returns the offset after it. In an
   * `attribute` context the value is rewritten into a valid JSX attribute
   * value. In an `expression` context it is rewritten into a JS expression.
   *
   * A value has no whitespace outside brackets. It is an optional prefix
   * operator such as `!`, a primary value, and then member accesses, calls
   * and indexes, as in `!props.items[0].label()`.
   */
  private parseValue(offset: number, context: ValueContext): number {
    const { source, scanner } = this;
    let start = offset;
    while (PREFIX_OPERATORS.includes(source[start]!)) {
      start++;
    }
    const prefixed = start > offset;
    const char = source[start];
    let end: number;
    let wrap = context === 'attribute';
    // Strings, objects and elements cannot be followed by member accesses.
    let chain = true;
    switch (char) {
      case '"':
      case "'":
        if (prefixed) {
          return this.fail('Wrap this attribute value in parentheses', offset);
        }
        // JSX strings have no escapes. JS strings do.
        end = scanner.skipString(start, context === 'expression');
        wrap = false;
        chain = false;
        break;
      case '`':
        end = scanner.skipTemplate(start);
        break;
      case '{': {
        if (prefixed) {
          return this.fail('Wrap this attribute value in parentheses', offset);
        }
        // Braces hold an object literal.
        end = scanner.scanExpression(start + 1, '}') + 1;
        if (context === 'expression') {
          this.output.appendLeft(start, '(');
          this.output.appendLeft(end, ')');
        }
        chain = false;
        break;
      }
      case '(':
        end = scanner.scanExpression(start + 1, ')') + 1;
        break;
      case '[':
        end = scanner.scanExpression(start + 1, ']') + 1;
        break;
      case '/':
        end = scanner.skipRegExp(start);
        break;
      case '<':
        if (prefixed) {
          return this.fail('Wrap this attribute value in parentheses', offset);
        }
        end = this.parseElement(start);
        wrap = false;
        chain = false;
        break;
      default: {
        const value = matchAt(BARE_VALUE, source, start);
        if (!value) {
          return this.fail('Expected an attribute value', offset);
        }
        end = start + value.length;
      }
    }
    if (chain) {
      end = this.parseChain(end);
      const next = source[end];
      if (next !== undefined && !isWhitespace(next) && next !== '>' && next !== '/') {
        this.fail('Wrap this attribute value in parentheses', offset);
      }
    }
    if (wrap) {
      this.output.appendLeft(offset, '{');
      this.output.appendLeft(end, '}');
    }
    return end;
  }

  /** Skips member accesses, calls, indexes and tagged templates after a value. */
  private parseChain(offset: number): number {
    const { source, scanner } = this;
    let i = offset;
    while (true) {
      const char = source[i];
      if (char === '?' && source[i + 1] === '.') {
        // `?.name`, `?.(...)` and `?.[...]`.
        i += 2;
        if (source[i] !== '(' && source[i] !== '[') {
          i = this.parseMemberName(i);
        }
      } else if (char === '.') {
        i = this.parseMemberName(i + 1);
      } else if (char === '(') {
        i = scanner.scanExpression(i + 1, ')') + 1;
      } else if (char === '[') {
        i = scanner.scanExpression(i + 1, ']') + 1;
      } else if (char === '`') {
        i = scanner.skipTemplate(i);
      } else if (char === '!' && source[i + 1] !== '=') {
        // A TypeScript non-null assertion.
        i++;
      } else {
        return i;
      }
    }
  }

  private parseMemberName(offset: number): number {
    const name = matchAt(MEMBER_NAME, this.source, offset);
    if (!name) {
      return this.fail('Expected a property name', offset);
    }
    return offset + name.length;
  }
}
