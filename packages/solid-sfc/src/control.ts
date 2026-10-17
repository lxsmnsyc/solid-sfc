/**
 * Control flow blocks in markup, such as `#if (a) { ... } #else { ... }`.
 * They are rewritten in place into JSX expressions and SolidJS components.
 */
import type { MagicString } from 'magic-string';
import { SFCError } from './error.ts';
import type { BlockImport } from './imports.ts';
import type { Scanner } from './scanner.ts';
import { isIdentifierPart, isWhitespace } from './scanner.ts';
import { analyzeBlockScript, maskMarkup } from './script.ts';

/** Helper from `solid-sfc/runtime` used by `#key`. */
export const KEY_IDENTIFIER = '__key';

const BLOCKS = new Set([
  'if',
  'for',
  'repeat',
  'switch',
  'try',
  'loading',
  'reveal',
  'portal',
  'hydration',
  'no-hydration',
  'key',
]);
const BRANCHES = new Set(['else', 'case', 'default', 'catch']);
// Keywords are lowercase words, joined by `-` as in `#no-hydration`.
const KEYWORD = /#([a-z]+(?:-[a-z]+)*)/y;

export interface ControlHost {
  readonly source: string;
  readonly output: MagicString;
  readonly scanner: Scanner;
  fail(message: string, offset: number): never;
  /** Writes `#if` as conditional expressions, so TypeScript narrows inside its branches. */
  readonly typeCheck?: boolean;
  /** Parses markup until the `}` that ends a block body. Returns its offset. */
  parseBody(offset: number): number;
}

interface Body {
  /** Offset of `{`. */
  open: number;
  start: number;
  /** Offset of `}`. */
  end: number;
  /** True if it starts with a `<script>` or `#template` declarations. */
  declarations: boolean;
}

interface Header {
  /** Offset of `(`. */
  open: number;
  start: number;
  /** Offset of `)`. */
  end: number;
}

/**
 * A prop that a block generates, such as `each` in `#for`. The prop has no
 * text in the source, so type errors on it are reported on its value.
 */
export interface GeneratedProp {
  name: string;
  /** Offset of the value in the source. */
  start: number;
  end: number;
}

/** A block body that is being parsed. */
interface Frame {
  start: number;
  /** The end of the `<script>` and `#template` declarations at its start. */
  declarationsEnd: number | undefined;
  /** The imports of its scripts. They are in scope until the end of the body. */
  imports: BlockImport[];
}

interface Keyword {
  name: string;
  /** Offset of `#`. */
  start: number;
  /** Offset after the keyword. */
  end: number;
}

/** Splits `text` at `separator` characters outside brackets and strings. */
function splitTopLevel(text: string, separator: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char)) {
      depth--;
    } else if (char === separator && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

/**
 * Finds `word` with whitespace on both sides, outside brackets and strings,
 * starting at `from`. Returns its offset in `text`, or -1.
 */
function findWord(text: string, word: string, from = 0): number {
  let depth = 0;
  let quote: string | undefined;
  for (let i = from; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      if (char === '\\') {
        i++;
      } else if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth++;
    } else if (')]}'.includes(char)) {
      depth--;
    } else if (
      depth === 0 &&
      text.startsWith(word, i) &&
      isWhitespace(text[i - 1]) &&
      isWhitespace(text[i + word.length])
    ) {
      return i;
    }
  }
  return -1;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const TEMPLATE_DECLARATION = /\s+[A-Za-z_$][\w$]*\s*\(/y;
// `#const name =` is matched only to point to scripts in blocks.
const CONST_DECLARATION = /\s*(?:[A-Za-z_$][\w$]*\s*=(?!=)|[{[])/y;

export class ControlFlowParser {
  private readonly host: ControlHost;
  /** True if `#key` is used, so the runtime helper must be imported. */
  usesKey = false;
  /** Props that the blocks generate, in source order. */
  readonly props: GeneratedProp[] = [];
  /** The body of each block, from `{` to `}`. Editors fold them. */
  readonly bodies: { start: number; end: number }[] = [];
  /** The imports of the scripts of blocks. The compiler moves them to the top of the module. */
  readonly imports: BlockImport[] = [];
  /** `#template` declarations at the top level. The compiler moves them before the markup. */
  readonly templates: { start: number; end: number }[] = [];
  /**
   * The block bodies being parsed, innermost last, with the end of their
   * `<script>` and `#template` declarations.
   */
  private readonly frames: Frame[] = [];

  constructor(host: ControlHost) {
    this.host = host;
  }

  /**
   * Returns the keyword if a control flow block starts at `offset`. A block is
   * `#` and a known keyword, followed by `(` or `{`, and not right after a
   * word character.
   */
  match(offset: number): Keyword | undefined {
    const { source } = this.host;
    if (source[offset] !== '#' || isIdentifierPart(source[offset - 1])) {
      return undefined;
    }
    const declaration = this.matchDeclaration(offset);
    if (declaration) {
      return declaration;
    }
    const keyword = this.readKeyword(offset);
    if (!keyword) {
      return undefined;
    }
    const next = source[this.host.scanner.skipWhitespace(keyword.end)];
    if (next !== '(' && next !== '{') {
      return undefined;
    }
    if (BRANCHES.has(keyword.name)) {
      this.host.fail(`#${keyword.name} must follow its block`, offset);
    }
    return BLOCKS.has(keyword.name) ? keyword : undefined;
  }

  /**
   * `#template` is followed by `name(`. `#const name =` is matched so that
   * it can point to scripts in blocks. Other text after them stays text.
   */
  private matchDeclaration(offset: number): Keyword | undefined {
    const keyword = this.readKeyword(offset);
    const pattern =
      keyword?.name === 'const'
        ? CONST_DECLARATION
        : keyword?.name === 'template'
          ? TEMPLATE_DECLARATION
          : undefined;
    if (!keyword || !pattern || !isWhitespace(this.host.source[keyword.end])) {
      return undefined;
    }
    pattern.lastIndex = keyword.end;
    return pattern.test(this.host.source) ? keyword : undefined;
  }

  /** Parses the block that starts at `keyword` and returns the offset after it. */
  parse(keyword: Keyword): number {
    switch (keyword.name) {
      case 'if':
        return this.parseIf(keyword);
      case 'for':
      case 'repeat':
        return this.parseLoop(keyword);
      case 'switch':
        return this.parseSwitch(keyword);
      case 'try':
        return this.parseBoundary(keyword, 'Errored', 'catch');
      case 'loading':
        return this.parseBoundary(keyword, 'Loading', 'else');
      case 'reveal':
        return this.parseWrapper(keyword, 'Reveal', ['order', 'collapsed']);
      case 'portal':
        return this.parseWrapper(keyword, 'Portal', ['mount']);
      case 'hydration':
        return this.parseWrapper(keyword, 'Hydration', ['id']);
      case 'no-hydration':
        return this.parseWrapper(keyword, 'NoHydration', []);
      case 'const':
        return this.parseConst(keyword);
      case 'template':
        return this.parseTemplate(keyword);
      default:
        return this.parseKey(keyword);
    }
  }

  private readKeyword(offset: number): Keyword | undefined {
    KEYWORD.lastIndex = offset;
    const match = KEYWORD.exec(this.host.source);
    if (!match || isIdentifierPart(this.host.source[offset + match[0].length])) {
      return undefined;
    }
    return { name: match[1]!, start: offset, end: offset + match[0].length };
  }

  private parseHeader(offset: number, keyword: string): Header {
    const { source, scanner } = this.host;
    const open = scanner.skipWhitespace(offset);
    if (source[open] !== '(') {
      this.host.fail(`Expected "(" after #${keyword}`, open);
    }
    const end = scanner.scanExpression(open + 1, ')');
    if (!source.slice(open + 1, end).trim()) {
      this.host.fail(`Expected an expression after #${keyword}`, open);
    }
    return { open, start: open + 1, end };
  }

  /** Parses a header if `(` follows `offset`. */
  private parseOptionalHeader(offset: number, keyword: string): Header | undefined {
    const { source, scanner } = this.host;
    return source[scanner.skipWhitespace(offset)] === '('
      ? this.parseHeader(offset, keyword)
      : undefined;
  }

  /**
   * Rewrites the arguments of a header into props, so `(a, b)` with `names`
   * `['order', 'collapsed']` becomes ` order={a} collapsed={b}`.
   */
  private headerProps(header: Header, keyword: string, names: string[]): void {
    const { source } = this.host;
    const args = splitTopLevel(source.slice(header.start, header.end), ',');
    if (names.length === 0) {
      this.host.fail(`#${keyword} takes no header`, header.open);
    }
    if (args.length > names.length || args.some((arg) => !arg.trim())) {
      this.host.fail(`Expected "(${names.join(', ')})" after #${keyword}`, header.start);
    }
    let offset = header.start;
    args.forEach((arg, index) => {
      // The text between arguments is replaced, and each argument stays in
      // place, so the source map keeps pointing at it.
      const start = offset + arg.length - arg.trimStart().length;
      const end = start + arg.trim().length;
      const next = offset + arg.length;
      this.update(offset, start, ` ${names[index]}={`);
      this.props.push({ name: names[index]!, start, end });
      this.update(end, index === args.length - 1 ? next : next + 1, '}');
      offset = next + 1;
    });
  }

  /**
   * `#reveal (order) { A }`, `#portal (mount) { A }`, `#hydration (id) { A }`
   * and `#no-hydration { A }` become components with props.
   */
  private parseWrapper(
    keyword: Keyword,
    tag: 'Reveal' | 'Portal' | 'Hydration' | 'NoHydration',
    names: string[],
  ): number {
    const header = this.parseOptionalHeader(keyword.end, keyword.name);
    const body = this.parseBody(header ? header.end + 1 : keyword.end, keyword.name);
    if (header) {
      this.update(keyword.start, header.start, `<${tag}`);
      this.headerProps(header, keyword.name, names);
      this.update(header.end, body.start, '>');
    } else {
      this.update(keyword.start, body.start, `<${tag}>`);
    }
    this.update(body.end, body.end + 1, `</${tag}>`);
    return body.end + 1;
  }

  /**
   * Parses a block body. Declarations at its start need a function body, so
   * the body becomes a function that is called in place. With `inFunction`,
   * the caller writes the body as the body of its own function instead, as
   * the callback of `<For>` does.
   */
  private parseBody(offset: number, keyword: string, inFunction = false): Body {
    const { source, scanner } = this.host;
    const open = scanner.skipWhitespace(offset);
    if (source[open] !== '{') {
      this.host.fail(`Expected "{" after #${keyword}`, open);
    }
    const frame: Frame = { start: open + 1, declarationsEnd: undefined, imports: [] };
    this.frames.push(frame);
    let end: number;
    try {
      end = this.host.parseBody(open + 1);
    } catch (error) {
      // A body that runs to the end of the file is unclosed. Editors blank
      // its opening line, such as `#if (a) {`, up to the brace.
      if (error instanceof SFCError && !error.recover && error.offset >= source.length) {
        const line = source.lastIndexOf('\n', open) + 1;
        error.recover = { start: scanner.skipWhitespace(line), end: open + 1 };
      }
      throw error;
    } finally {
      this.frames.pop();
    }
    for (const info of frame.imports) {
      info.scope.end = end;
    }
    this.bodies.push({ start: open, end });
    const declarations = frame.declarationsEnd !== undefined;
    if (declarations) {
      // The markup is the result of the function. `return` starts a line
      // at the indentation of the declarations, if the markup does.
      const first = this.skipTrivia(frame.start);
      const lineStart = source.lastIndexOf('\n', first - 1) + 1;
      const after = source.slice(
        frame.declarationsEnd,
        scanner.skipWhitespace(frame.declarationsEnd!),
      );
      const indent = after.includes('\n')
        ? `\n${source.slice(lineStart, scanner.skipWhitespace(lineStart))}`
        : ' ';
      this.host.output.appendLeft(frame.declarationsEnd!, `${indent}return <>`);
      if (!inFunction) {
        this.host.output.prependRight(open + 1, '{(() => {');
        this.host.output.appendLeft(end, '</>; })()}');
      }
    }
    return { open, start: open + 1, end, declarations };
  }

  /** Skips whitespace and comments. */
  private skipTrivia(offset: number): number {
    const { source, scanner } = this.host;
    let i = scanner.skipWhitespace(offset);
    while (source.startsWith('<!--', i)) {
      const end = source.indexOf('-->', i + 4);
      if (end === -1) {
        this.host.fail('Unterminated comment', i);
      }
      i = scanner.skipWhitespace(end + 3);
    }
    return i;
  }

  /** Returns the branch keyword after a block body, if it is one of `names`. */
  private nextBranch(offset: number, names: string[]): Keyword | undefined {
    const i = this.skipTrivia(offset);
    if (this.host.source[i] !== '#') {
      return undefined;
    }
    const keyword = this.readKeyword(i);
    return keyword && names.includes(keyword.name) ? keyword : undefined;
  }

  private update(start: number, end: number, content: string): void {
    if (end > start) {
      this.host.output.update(start, end, content);
    } else {
      this.host.output.appendLeft(start, content);
    }
  }

  /**
   * Moves a branch body in front of `target`, wrapped in `before` and `after`.
   * Used for fallbacks, which are written after the body but are props.
   */
  private moveBody(body: Body, target: number, before: string, after: string): void {
    const { output } = this.host;
    if (body.end === body.start) {
      output.appendLeft(target, `${before}${after}`);
      return;
    }
    output.prependRight(body.start, before);
    output.appendLeft(body.end, after);
    output.move(body.start, body.end, target);
  }

  /**
   * `#if (a) { A } #else { C }` becomes `<Show when={a} fallback={<>C</>}>A</Show>`.
   * With `#else if`, the branches become `<Match>` elements in a `<Switch>`.
   * For type-checking, the blocks become conditional expressions instead,
   * `{(a) ? <>A</> : (b) ? <>B</> : <>C</>}`, so TypeScript narrows values
   * inside each branch.
   */
  private parseIf(keyword: Keyword): number {
    const branches: { header: Header; body: Body }[] = [];
    let header = this.parseHeader(keyword.end, 'if');
    branches.push({ header, body: this.parseBody(header.end + 1, 'if') });
    let fallback: Body | undefined;
    while (true) {
      const branch = this.nextBranch(branches.at(-1)!.body.end + 1, ['else']);
      if (!branch) {
        break;
      }
      const next = this.host.scanner.skipWhitespace(branch.end);
      if (this.readWord(next) !== 'if') {
        fallback = this.parseBody(branch.end, 'else');
        break;
      }
      header = this.parseHeader(next + 2, 'else if');
      branches.push({ header, body: this.parseBody(header.end + 1, 'else if') });
    }
    const last = fallback ?? branches.at(-1)!.body;

    if (this.host.typeCheck) {
      branches.forEach((item, index) => {
        const start = index === 0 ? keyword.start : branches[index - 1]!.body.end;
        this.update(start, item.header.start, index === 0 ? '{(' : '</> : (');
        this.update(item.header.end, item.body.start, ') ? <>');
      });
      if (fallback) {
        this.update(branches.at(-1)!.body.end, fallback.start, '</> : <>');
        this.update(fallback.end, fallback.end + 1, '</>}');
      } else {
        this.update(last.end, last.end + 1, '</> : null}');
      }
      return last.end + 1;
    }

    // `when={` comes right before the condition, so editors can map it.
    const condition = (item: { header: Header }) => this.trim(item.header.start, item.header.end);
    if (branches.length === 1) {
      const [{ header: only, body }] = branches as [{ header: Header; body: Body }];
      const { start, end } = condition(branches[0]!);
      this.update(keyword.start, start, '<Show when={');
      this.props.push({ name: 'when', start, end });
      this.update(end, only.end + 1, '}');
      if (fallback) {
        this.moveFallback(fallback, body, only.end + 1);
      }
      this.update(only.end + 1, body.start, '>');
      if (!fallback) {
        this.update(body.end, body.end + 1, '</Show>');
      }
      return last.end + 1;
    }

    // Each `<Match>` starts a line at the indentation of the block.
    const { source } = this.host;
    const lineStart = source.lastIndexOf('\n', keyword.start - 1) + 1;
    const indent = `\n${source.slice(lineStart, this.host.scanner.skipWhitespace(lineStart))}`;
    this.update(keyword.start, keyword.end, '<Switch');
    branches.forEach((item, index) => {
      const { start, end } = condition(item);
      const from = index === 0 ? keyword.end : branches[index - 1]!.body.end;
      this.update(from, start, `${index === 0 ? '>' : '</Match>'}${indent}<Match when={`);
      this.props.push({ name: 'when', start, end });
      this.update(end, item.body.start, '}>');
    });
    const body = branches.at(-1)!.body;
    const close = `</Match>${indent}</Switch>`;
    if (fallback) {
      this.moveFallback(fallback, body, keyword.end, close);
    } else {
      this.update(body.end, body.end + 1, close);
    }
    return last.end + 1;
  }

  /**
   * Moves the `#else` body after `body` into a `fallback` prop at `target`,
   * and closes the element with `close`.
   */
  private moveFallback(fallback: Body, body: Body, target: number, close = '</Show>'): void {
    this.update(body.end, fallback.start, close);
    this.update(fallback.end, fallback.end + 1, '');
    this.moveBody(fallback, target, ' fallback={<>', '</>}');
  }

  private readWord(offset: number): string {
    const { source } = this.host;
    let end = offset;
    while (isIdentifierPart(source[end])) {
      end++;
    }
    return source.slice(offset, end);
  }

  /** Trims whitespace from both ends of a range of the source. */
  private trim(start: number, end: number): { start: number; end: number } {
    const { source } = this.host;
    while (start < end && isWhitespace(source[start])) {
      start++;
    }
    while (end > start && isWhitespace(source[end - 1])) {
      end--;
    }
    return { start, end };
  }

  /**
   * `#for (item, index of list) { A } #else { B }` becomes
   * `<For each={list} fallback={<>B</>}>{(item, index) => <>A</>}</For>`.
   * `by` picks what identifies an item: `by item.id` passes a key function,
   * and `by index` keeps one entry per position. `#repeat (index of count)`
   * uses `<Repeat>`, and its index is optional. Parameters that Solid passes as accessors become
   * reactive variables, so they are read without a call.
   */
  private parseLoop(keyword: Keyword): number {
    const { source, fail } = this.bind();
    const repeat = keyword.name === 'repeat';
    const header = this.parseHeader(keyword.end, keyword.name);
    const text = source.slice(header.start, header.end);
    const expected = repeat
      ? '"count" or "index of count"'
      : '"item of list" or "item, index of list"';
    const of = findWord(text, 'of');
    // `#repeat (count)` needs no index.
    if (of === -1 && !repeat) {
      fail(`Expected ${expected} after #for`, header.start);
    }
    const params =
      of === -1 ? [] : splitTopLevel(text.slice(0, of), ',').map((param) => param.trim());
    if (params.length > (repeat ? 1 : 2) || params.some((param) => !param)) {
      fail(`Expected ${expected} after #${keyword.name}`, header.start);
    }
    const by = repeat || of === -1 ? -1 : findWord(text, 'by', of + 2);
    const list = this.trim(
      of === -1 ? header.start : header.start + of + 2,
      by === -1 ? header.end : header.start + by,
    );
    const key = by === -1 ? undefined : this.trim(header.start + by + 2, header.end);
    if (list.start === list.end || (key && key.start === key.end)) {
      fail(`Expected ${expected} after #${keyword.name}`, header.start);
    }

    // `by index`, or `by` and the name of the index, keeps one entry per position.
    const keyText = key && source.slice(key.start, key.end);
    const mode = repeat
      ? 'repeat'
      : !key
        ? 'reference'
        : keyText === 'index' || keyText === params[1]
          ? 'position'
          : 'key';
    // Which parameters Solid passes as accessors.
    const accessors = {
      repeat: [false],
      reference: [false, true],
      position: [true, false],
      key: [true, true],
    }[mode];
    const names: string[] = [];
    const derefs: string[] = [];
    params.forEach((param, position) => {
      if (!accessors[position]) {
        names.push(param);
        return;
      }
      if (IDENTIFIER.test(param)) {
        names.push(`__${param}`);
        derefs.push(`const ${param} = $derefMemo(__${param});`);
        return;
      }
      if (position === 1) {
        fail(`The index of #for must be an identifier`, header.start);
      }
      // A destructured item reads its properties when they are used.
      names.push('__item');
      derefs.push(
        `const __itemValue = $derefMemo(__item); const ${param} = $destructure(__itemValue);`,
      );
    });
    const tag = repeat ? 'Repeat' : 'For';
    const prop = repeat ? 'count' : 'each';

    this.update(keyword.start, list.start, `<${tag} ${prop}={`);
    this.props.push({ name: prop, start: list.start, end: list.end });
    if (mode === 'key') {
      this.update(list.end, key!.start, `} keyed={(${params[0]}) => (`);
      this.update(key!.end, header.end + 1, ')}');
    } else {
      this.update(list.end, header.end + 1, mode === 'position' ? '} keyed={false}' : '}');
    }
    const body = this.parseBody(header.end + 1, keyword.name, true);
    // Declarations in the body go in the callback, after the parameters.
    const callback = body.declarations
      ? `{(${names.join(', ')}) => {${derefs.map((deref) => ` ${deref}`).join('')}`
      : derefs.length
        ? `{(${names.join(', ')}) => { ${derefs.join(' ')} return <>`
        : `{(${names.join(', ')}) => <>`;
    const close = `</>${body.declarations || derefs.length ? '; }' : ''}}</${tag}>`;
    this.update(header.end + 1, body.start, `>${callback}`);

    const branch = this.nextBranch(body.end + 1, ['else']);
    if (!branch) {
      this.update(body.end, body.end + 1, close);
      return body.end + 1;
    }
    const fallback = this.parseBody(branch.end, 'else');
    this.update(body.end, fallback.start, close);
    this.update(fallback.end, fallback.end + 1, '');
    this.moveBody(fallback, header.end + 1, ' fallback={<>', '</>}');
    return fallback.end + 1;
  }

  /** `#switch { #case (a) { A } #default { B } }` becomes `<Switch>` and `<Match>`. */
  private parseSwitch(keyword: Keyword): number {
    const { source, fail } = this.bind();
    const open = this.host.scanner.skipWhitespace(keyword.end);
    if (source[open] !== '{') {
      fail('Expected "{" after #switch', open);
    }
    this.update(keyword.start, open + 1, `<${'Switch'}>`);
    const match = 'Match';
    let cursor = open + 1;
    let hasDefault = false;
    while (true) {
      const next = this.skipTrivia(cursor);
      // Whitespace and comments between cases are dropped.
      this.update(cursor, next, '');
      if (source[next] === '}') {
        this.bodies.push({ start: open, end: next });
        this.update(next, next + 1, `</${'Switch'}>`);
        return next + 1;
      }
      const branch = source[next] === '#' ? this.readKeyword(next) : undefined;
      if (!branch || (branch.name !== 'case' && branch.name !== 'default')) {
        return fail('Expected #case, #default or "}" in #switch', next);
      }
      if (hasDefault) {
        fail('#default must be the last branch of #switch', next);
      }
      let body: Body;
      if (branch.name === 'case') {
        const header = this.parseHeader(branch.end, 'case');
        const start = this.host.scanner.skipWhitespace(header.start);
        let end = header.end;
        while (isWhitespace(source[end - 1])) {
          end--;
        }
        this.update(branch.start, start, `<${match} when={`);
        this.props.push({ name: 'when', start, end });
        body = this.parseBody(header.end + 1, 'case');
        this.update(end, body.start, '}><>');
      } else {
        hasDefault = true;
        body = this.parseBody(branch.end, 'default');
        this.update(branch.start, body.start, `<${match} when={true}><>`);
      }
      this.update(body.end, body.end + 1, `</></${match}>`);
      cursor = body.end + 1;
    }
  }

  /**
   * `#try { A } #catch (error, reset) { B }` becomes
   * `<Errored fallback={(error, reset) => <>B</>}>A</Errored>`.
   * `#loading { A } #else { B }` becomes `<Loading fallback={<>B</>}>A</Loading>`.
   */
  private parseBoundary(
    keyword: Keyword,
    tag: 'Errored' | 'Loading',
    fallbackKeyword: 'catch' | 'else',
  ): number {
    const { source, fail } = this.bind();
    // `#loading (value)` shows the fallback again when the value changes.
    const onHeader =
      tag === 'Loading' ? this.parseOptionalHeader(keyword.end, keyword.name) : undefined;
    const body = this.parseBody(onHeader ? onHeader.end + 1 : keyword.end, keyword.name);
    if (onHeader) {
      this.update(keyword.start, onHeader.start, `<${tag}`);
      this.headerProps(onHeader, keyword.name, ['on']);
      this.update(onHeader.end, body.open, '');
    } else {
      this.update(keyword.start, body.open, `<${tag}`);
    }
    this.update(body.open, body.start, '>');

    const branch = this.nextBranch(body.end + 1, [fallbackKeyword]);
    if (!branch) {
      if (tag === 'Errored') {
        fail('#try needs a #catch block', body.end);
      }
      this.update(body.end, body.end + 1, `</${tag}>`);
      return body.end + 1;
    }
    let before = ' fallback={<>';
    let after = '</>}';
    let next = branch.end;
    if (fallbackKeyword === 'catch' && source[this.host.scanner.skipWhitespace(next)] === '(') {
      const header = this.parseHeader(next, 'catch');
      const [error, reset, ...rest] = splitTopLevel(
        source.slice(header.start, header.end),
        ',',
      ).map((param) => param.trim());
      if (!error || rest.length > 0 || !IDENTIFIER.test(error)) {
        fail('Expected "(error)" or "(error, reset)" after #catch', header.start);
      }
      // The error is an accessor, so it becomes a reactive variable.
      before = ` fallback={(__${error}${reset ? `, ${reset}` : ''}) => { const ${error} = $derefMemo(__${error}); return <>`;
      after = '</>; }}';
      next = header.end + 1;
    }
    const fallback = this.parseBody(next, fallbackKeyword);
    this.update(body.end, fallback.start, `</${tag}>`);
    this.update(fallback.end, fallback.end + 1, '');
    this.moveBody(fallback, body.open, before, after);
    return fallback.end + 1;
  }

  /**
   * Returns the block that a declaration belongs to, or undefined at the top
   * level. Declarations come before the markup of their block.
   */
  private declarationFrame(keyword: Keyword): Frame | undefined {
    return this.frameAt(`#${keyword.name}`, keyword.start);
  }

  private frameAt(name: string, offset: number): Frame | undefined {
    const frame = this.frames.at(-1);
    if (frame && this.skipTrivia(frame.declarationsEnd ?? frame.start) !== offset) {
      this.host.fail(`${name} must come before the markup of its block`, offset);
    }
    return frame;
  }

  /**
   * A `<script>` directly in a block runs its statements each time the block
   * body is created, such as once for each item of `#for`. Its variables are
   * visible in the markup of the block.
   */
  parseScript(offset: number): number {
    const { source, fail } = this.bind();
    const { scanner } = this.host;
    const frame = this.frameAt('<script>', offset);
    if (!frame) {
      return fail('<script> must be at the top level or directly inside a block', offset);
    }
    const tagEnd = scanner.skipWhitespace(offset + '<script'.length);
    if (source[tagEnd] !== '>') {
      fail('A <script> in a block takes no attributes', tagEnd);
    }
    const contentStart = tagEnd + 1;
    const contentEnd = scanner.scanScript(contentStart);
    const close = scanner.skipWhitespace(contentEnd + '</script'.length);
    if (source[close] !== '>') {
      fail('Expected ">"', close);
    }
    const markup = scanner.scanCode(contentStart, contentEnd);
    const masked = maskMarkup(source, contentStart, contentEnd, markup);
    for (const info of analyzeBlockScript(masked, contentStart, fail)) {
      const blockImport = { ...info, scope: { start: contentStart, end: contentEnd } };
      frame.imports.push(blockImport);
      this.imports.push(blockImport);
    }
    // A `<script>` on a line of its own takes the line with it, so the code
    // starts on the next line.
    const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
    const contentLine = source.indexOf('\n', contentStart) + 1;
    const alone =
      !source.slice(lineStart, offset).trim() &&
      contentLine > 0 &&
      contentLine <= contentEnd &&
      !source.slice(contentStart, contentLine).trim();
    if (alone && lineStart > frame.start) {
      this.update(lineStart, contentLine, '');
    } else {
      this.update(offset, contentStart, '');
    }
    // The code may not end with `;`.
    const code = source.slice(contentStart, contentEnd);
    const codeEnd = contentStart + code.trimEnd().length;
    this.update(codeEnd, close + 1, code.trimEnd().endsWith(';') ? '' : ';');
    frame.declarationsEnd = close + 1;
    return close + 1;
  }

  /**
   * `#template row(item) { A }` becomes `const row = (item) => <>A</>;`. In a
   * block it is a declaration, like a `<script>`. At the top level the compiler
   * moves it before the markup, so the whole file can use it.
   */
  private parseTemplate(keyword: Keyword): number {
    const { source, scanner } = this.host;
    const frame = this.declarationFrame(keyword);
    const nameStart = scanner.skipWhitespace(keyword.end);
    const name = /[A-Za-z_$][\w$]*/y;
    name.lastIndex = nameStart;
    const nameEnd = nameStart + name.exec(source)![0].length;
    const open = scanner.skipWhitespace(nameEnd);
    const close = scanner.scanExpression(open + 1, ')');
    const body = this.parseBody(close + 1, 'template', true);
    this.update(keyword.start, nameStart, 'const ');
    this.update(nameEnd, open, ' = ');
    this.update(close + 1, body.start, body.declarations ? ' => {' : ' => <>');
    this.update(body.end, body.end + 1, body.declarations ? '</>; };' : '</>;');
    if (frame) {
      frame.declarationsEnd = body.end + 1;
    } else {
      this.templates.push({ start: keyword.start, end: body.end + 1 });
    }
    return body.end + 1;
  }

  /** `#const` was replaced by scripts in blocks. */
  private parseConst(keyword: Keyword): number {
    return this.host.fail(
      'Use a <script> at the start of the block instead of #const, as in <script>const name = $memo(value);</script>',
      keyword.start,
    );
  }

  /** `#key (value) { A }` renders `A` again when `value` changes. */
  private parseKey(keyword: Keyword): number {
    this.usesKey = true;
    const header = this.parseHeader(keyword.end, 'key');
    this.update(keyword.start, header.start, `{${KEY_IDENTIFIER}(() => (`);
    const body = this.parseBody(header.end + 1, 'key');
    this.update(header.end, body.start, '), () => <>');
    this.update(body.end, body.end + 1, '</>)}');
    return body.end + 1;
  }

  private bind(): { source: string; fail: (message: string, offset: number) => never } {
    const { host } = this;
    return { source: host.source, fail: (message, offset) => host.fail(message, offset) };
  }
}
