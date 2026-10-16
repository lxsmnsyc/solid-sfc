import { MagicString } from 'magic-string';
import { ControlFlowParser } from './control.ts';
import { SFCError } from './error.ts';
import { Scanner, isWhitespace } from './scanner.ts';
import type { BlockImport } from './imports.ts';
import { maskMarkup } from './script.ts';

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
  group: { tags: ['input'], event: 'onChange' },
  open: { tags: ['details', 'dialog'], event: 'onToggle' },
  files: { tags: ['input'], event: 'onChange' },
};

/** Helper from `solid-sfc/runtime` used by `bind:value` on `<select multiple>`. */
export const SELECT_VALUES_IDENTIFIER = '__selectValues';

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
  /** True if a dynamic tag `<{tag}>` is used. */
  usesDynamic: boolean;
  /** True if `bind:value` is used on `<select multiple>`. */
  usesSelectValues: boolean;
  /** The markup in the code of top-level `<script>` blocks. */
  scriptMarkup: Range[];
  /** The imports of the scripts of blocks. */
  blockImports: BlockImport[];
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
  /** True for `<{tag}>`, whose tag is only known at runtime. */
  dynamicTag: boolean;
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

// The `solid:` elements. Solid components that a control flow block or
// `<{tag}>` replaces are not elements, so `<solid:for>` points to `#for`.
const SOLID_ELEMENTS = new Set(['window', 'document', 'hydration-script']);
const REPLACED_ELEMENTS: Record<string, string> = {
  dynamic: '<{tag}>',
  for: '#for',
  show: '#if',
  switch: '#switch',
  match: '#case',
  repeat: '#repeat',
  errored: '#try',
  loading: '#loading',
  reveal: '#reveal',
  portal: '#portal',
  hydration: '#hydration',
  'no-hydration': '#no-hydration',
};

/** `dynamic` from `@solidjs/web`, used by `<{tag}>`. */
export const DYNAMIC_IDENTIFIER = '__dynamic';
const DYNAMIC_TAG = '__Tag';

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
  private scope: TemplateScope | undefined;
  private readonly control: ControlFlowParser;
  private mergesStyle = false;
  private usesListen = false;
  private usesDynamic = false;
  private usesSelectValues = false;
  private readonly elements: ElementInfo[] = [];
  private readonly scriptMarkup: Range[] = [];
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
      usesDynamic: this.usesDynamic,
      usesSelectValues: this.usesSelectValues,
      scriptMarkup: this.scriptMarkup,
      blockImports: this.control.imports,
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
  private parseChildren(
    offset: number,
    mode: ChildrenMode,
    blocks?: Block[],
    opener?: Range,
  ): number {
    const { source } = this;
    let i = offset;
    while (i < source.length) {
      const char = source[i];
      if (char === '<') {
        if (source.startsWith('<!--', i)) {
          i = this.removeComment(i);
        } else if (source[i + 1] === '/') {
          if (mode !== 'element') {
            // A stray closing tag is blanked.
            const end = source.indexOf('>', i);
            this.failAndRecover(
              mode === 'block' ? 'Expected "}" to close the block' : 'Unexpected closing tag',
              i,
              { start: i, end: end === -1 ? i + 2 : end + 1 },
            );
          }
          return i;
        } else if (blocks && /^<(script|style)[\s>]/.test(source.slice(i, i + 8))) {
          const block = this.parseBlock(i);
          blocks.push(block);
          if (block.type === 'script') {
            this.parseScriptMarkup(block);
          }
          i = block.end;
        } else if (/^<script[\s>]/.test(source.slice(i, i + 8))) {
          if (mode !== 'block') {
            this.fail('<script> must be at the top level or directly inside a block', i);
          }
          i = this.control.parseScript(i);
        } else {
          i = this.parseElement(i, true);
        }
      } else if (char === '{') {
        i = this.scanner.scanExpression(i + 1, '}') + 1;
      } else if (char === '}' && mode === 'block') {
        return i;
      } else if (char === '#') {
        const keyword = this.control.match(i);
        if (keyword?.name === 'template' && mode === 'element') {
          this.fail('#template must be at the top level or directly inside a block', i);
        }
        i = keyword ? this.control.parse(keyword) : i + 1;
      } else {
        i++;
      }
    }
    if (mode === 'element') {
      this.failAndRecover(
        'Unexpected end of file, expected a closing tag',
        i,
        opener ?? { start: offset, end: offset },
      );
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

  /** Parses the markup in script code from `start` to `end`. */
  scanCode(start: number, end: number): Range[] {
    return this.scanner.scanCode(start, end);
  }

  /**
   * Parses the markup in the code of a top-level `<script>`. A module script
   * runs outside the component, so its elements get no CSS variables.
   */
  private parseScriptMarkup(block: Block): void {
    const { scope } = this;
    if ('module' in block.attributes && scope) {
      this.scope = { ...scope, variables: undefined };
    }
    this.scriptMarkup.push(...this.scanner.scanCode(block.contentStart, block.contentEnd));
    this.scope = scope;
  }

  /**
   * Parses an element or fragment at `offset` and returns the offset after
   * it. `braces` is true where a JSX expression needs braces, as in children.
   */
  private parseElement(offset: number, braces = false): number {
    const { source } = this;
    if (source[offset + 1] === '>') {
      const opener = { start: offset, end: offset + 2 };
      const close = this.parseChildren(offset + 2, 'element', undefined, opener);
      return this.parseClosingTag(close, '', opener);
    }
    if (source[offset + 1] === '{') {
      return this.parseDynamicElement(offset, braces);
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
      dynamicTag: false,
    };
    if (native) {
      this.elements.push(element);
    }
    if (scope) {
      this.output.appendLeft(nameEnd, ` ${scope.attribute}`);
    }
    const { end, attributesEnd, selfClosing, hasStyle } = this.recoverTag(offset, () =>
      this.parseAttributes(nameEnd, name, scope, element),
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
    const opener = { start: offset, end };
    const close = this.parseChildren(end, 'element', undefined, opener);
    return this.parseClosingTag(close, name, opener);
  }

  /**
   * Runs `parse` on the tag that starts at `offset`. If it fails, editors
   * blank the tag up to the error, as in an unfinished `<div cla`.
   */
  private recoverTag<T>(offset: number, parse: () => T): T {
    try {
      return parse();
    } catch (error) {
      if (error instanceof SFCError && !error.recover) {
        error.recover = { start: offset, end: Math.max(error.offset, offset + 1) };
      }
      throw error;
    }
  }

  /** Fails, and tells editors to blank `recover` to compile the rest. */
  private failAndRecover(message: string, offset: number, recover: Range): never {
    try {
      return this.fail(message, offset);
    } catch (error) {
      if (error instanceof SFCError) {
        error.recover = recover;
      }
      throw error;
    }
  }

  /**
   * `<{tag} a=b>children</>` becomes
   * `(() => { const __Tag = __dynamic(() => tag); return <__Tag a={b}>children</__Tag>; })()`,
   * so each element gets its own component. The tag can be any expression.
   * It gets the scope attribute, since it can be a native element.
   */
  private parseDynamicElement(offset: number, braces: boolean): number {
    const { source, output } = this;
    const close = this.scanner.scanExpression(offset + 2, '}');
    if (!source.slice(offset + 2, close).trim()) {
      return this.fail('Expected an expression for the tag', offset + 1);
    }
    this.usesDynamic = true;
    const [open, end] = braces ? ['{', '}'] : ['', ''];
    output.update(
      offset,
      offset + 2,
      `${open}(() => { const ${DYNAMIC_TAG} = ${DYNAMIC_IDENTIFIER}(() => `,
    );
    output.update(close, close + 1, `); return <${DYNAMIC_TAG}`);
    const nameEnd = close + 1;
    const scope = this.scope;
    const ignores =
      this.ignore && this.scanner.skipWhitespace(this.ignore.end) === offset
        ? this.ignore.codes
        : new Set<string>();
    const element: ElementInfo = {
      tag: '*',
      offset,
      attributes: new Map(),
      spread: false,
      ignores,
      classes: new Set(),
      ids: new Set(),
      dynamicClass: false,
      dynamicId: false,
      dynamicTag: true,
    };
    this.elements.push(element);
    if (scope) {
      output.appendLeft(nameEnd, ` ${scope.attribute}`);
    }
    const {
      end: tagEnd,
      attributesEnd,
      selfClosing,
      hasStyle,
    } = this.recoverTag(offset, () => this.parseAttributes(nameEnd, '', scope, element));
    if (scope?.variables && !hasStyle) {
      output.appendLeft(attributesEnd, ` style={${scope.variables}()}`);
    }
    const after = `; })()${end}`;
    if (selfClosing) {
      output.appendLeft(tagEnd, after);
      return tagEnd;
    }
    const opener = { start: offset, end: tagEnd };
    const closing = this.parseChildren(tagEnd, 'element', undefined, opener);
    output.appendLeft(closing + 2, DYNAMIC_TAG);
    const elementEnd = this.parseClosingTag(closing, '', opener);
    output.appendLeft(elementEnd, after);
    return elementEnd;
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

  /**
   * Parses the closing tag of the element that `opener` opened. If it does
   * not match, editors blank the opener, so its children belong to the parent.
   */
  private parseClosingTag(offset: number, name: string, opener: Range): number {
    const { source } = this;
    let i = this.scanner.skipWhitespace(offset + 2);
    const closing = matchAt(TAG_NAME, source, i) ?? '';
    if (closing !== name) {
      // An element that runs into the end of a script is likely a type.
      const hint =
        closing === 'script' && name !== 'script'
          ? '. In a script, <T> starts an element, as in a .tsx file. Write type parameters as <T,> and assertions as "value as T"'
          : '';
      this.failAndRecover(
        `${name ? `Expected </${name}>` : 'Expected </>'}${hint}`,
        offset,
        opener,
      );
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
    // The value of the `value` attribute as a JS expression, for `bind:group`.
    let value: string | undefined;
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
        this.applyBindings(tag, bindings, names, type, value);
        return { end: i + 2, attributesEnd, selfClosing: true, hasStyle };
      }
      if (char === '>') {
        this.applyBindings(tag, bindings, names, type, value);
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
          if (inner === 'value') {
            value = inner;
          }
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
        // `(name)` was a second shorthand. `{name}` is the only one now.
        const close = this.scanner.scanExpression(i + 1, ')');
        const inner = source.slice(i + 1, close).trim();
        this.fail(
          IDENTIFIER.test(inner)
            ? `Use {${inner}} for the shorthand of ${inner}={${inner}}`
            : 'Expected an attribute',
          i,
        );
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
          // The binding adds the braces where it needs them.
          const valueEnd = this.parseValue(valueStart, 'expression');
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
          if (name === 'value') {
            // A string in JSX has no escapes, so its text becomes a JS string.
            const text = source.slice(valueStart, i);
            value = '"\''.includes(text[0]!) ? JSON.stringify(text.slice(1, -1)) : `(${text})`;
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
   * The other bindings follow the same shape:
   *
   * - `bind:group=choice` on a radio button with `value="a"` becomes
   *   `checked={(choice) === "a"}`, and on a checkbox, `checked={(choice).includes("a")}`.
   * - `bind:open` on `<dialog>` listens to `close`, since `toggle` is newer there.
   * - `bind:files` only listens, since a file input cannot be set.
   * - `bind:value` on `<select multiple>` selects the options with a ref.
   */
  private applyBindings(
    tag: string,
    bindings: Binding[],
    names: Set<string>,
    type: string | undefined,
    value: string | undefined,
  ): void {
    const { source, output } = this;
    for (const binding of bindings) {
      const name = `bind:${binding.property}`;
      const config = BINDINGS[binding.property];
      if (!config || !config.tags.includes(tag)) {
        this.fail(
          `${name} is not supported on ${tag ? `<${tag}>` : 'a dynamic tag'}`,
          binding.start,
        );
      }
      const multiple = tag === 'select' && names.has('multiple');
      let event = config.event;
      if (tag === 'dialog') {
        event = 'onClose';
      } else if (multiple) {
        event = 'onChange';
      }
      if (names.has(event)) {
        this.fail(`${name} sets ${event}, so the element cannot have its own`, binding.start);
      }
      const target = source.slice(binding.valueStart, binding.valueEnd);
      if (!BIND_TARGET.test(target)) {
        this.fail(`${name} needs a variable or a property`, binding.valueStart);
      }
      let read = `event.currentTarget.${binding.property}`;
      if (binding.property === 'value' && (type === 'number' || type === 'range')) {
        read = 'event.currentTarget.valueAsNumber';
      }

      if (binding.property === 'group') {
        if (type !== 'radio' && type !== 'checkbox') {
          this.fail(`${name} needs type="radio" or type="checkbox"`, binding.start);
        }
        if (value === undefined) {
          this.fail(`${name} needs a value attribute`, binding.start);
        }
        if (names.has('checked')) {
          this.fail(`${name} sets checked, so the element cannot have its own`, binding.start);
        }
        output.update(binding.start, binding.valueStart, 'checked={(');
        output.appendLeft(
          binding.valueEnd,
          type === 'radio' ? `) === ${value}}` : `).includes(${value})}`,
        );
        read =
          type === 'radio'
            ? value
            : `event.currentTarget.checked ? [...${target}, ${value}] : ${target}.filter((__item) => __item !== ${value})`;
      } else if (binding.property === 'files') {
        if (type !== 'file') {
          this.fail(`${name} needs type="file"`, binding.start);
        }
        output.update(binding.start, binding.valueStart, `${event}={(event) => (`);
        output.appendLeft(binding.valueEnd, ` = ${read})}`);
        continue;
      } else if (multiple) {
        if (names.has('ref')) {
          this.fail(
            `${name} on <select multiple> sets ref, so the element cannot have its own`,
            binding.start,
          );
        }
        this.usesSelectValues = true;
        output.update(binding.start, binding.valueStart, `ref={${SELECT_VALUES_IDENTIFIER}(() => `);
        output.appendLeft(binding.valueEnd, ')}');
        read = 'Array.from(event.currentTarget.selectedOptions, (option) => option.value)';
      } else {
        // `bind:` is removed, so the property name keeps its place in the source.
        output.remove(binding.start, binding.start + 5);
        output.appendLeft(binding.valueStart, '{');
        output.appendLeft(binding.valueEnd, '}');
      }
      const prefix = ` ${event}={(event) => (`;
      output.appendLeft(binding.valueEnd, `${prefix}${target} = ${read})}`);
      // The copy of the target follows the last character of the value, the
      // text that closes it, and the prefix.
      const closing =
        binding.property === 'group'
          ? type === 'radio'
            ? `) === ${value}}`
            : `).includes(${value})}`
          : multiple
            ? ')}'
            : '}';
      this.generated.push({
        text: target,
        anchor: binding.valueEnd - 1,
        delta: 1 + closing.length + prefix.length,
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
        end = this.parseElement(start, context === 'attribute');
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

function throwError(message: string): never {
  throw new Error(message);
}

/**
 * Masks the markup in the code of a script, for tools that parse the script
 * on its own. The code is returned as is if its markup has a syntax error.
 */
export function maskScriptMarkup(code: string): string {
  try {
    const parser = new TemplateParser(code, new MagicString(code), throwError);
    return maskMarkup(code, 0, code.length, parser.scanCode(0, code.length));
  } catch {
    return code;
  }
}
