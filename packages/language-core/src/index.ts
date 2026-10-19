import { decode } from '@jridgewell/sourcemap-codec';
import type {
  CodeInformation,
  CodeMapping,
  IScriptSnapshot,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptServiceScript } from '@volar/typescript';
import { parseSync } from 'oxc-parser';
import { maskScriptMarkup } from 'solid-sfc';
import type { SFCError, SourceMap } from 'solid-sfc';
import { compileForEditor } from './recovery.ts';

export const LANGUAGE_ID = 'solid';
export const EXTENSION = '.solid';

/** Every language feature, for code that is copied from the file. */
const ALL_FEATURES: CodeInformation = {
  verification: true,
  completion: true,
  semantic: true,
  navigation: true,
  structure: true,
  format: true,
};

/** Generated TSX is not formatted, because the file keeps its own layout. */
const SCRIPT_FEATURES: CodeInformation = { ...ALL_FEATURES, format: false };

// "is declared but its value is never read" and its variants.
const UNUSED_DIAGNOSTICS = new Set([6133, 6138, 6192, 6196, 6198, 6199, 6205]);

/**
 * The fallback script has no markup, so variables that only the markup reads
 * would be reported as unused.
 */
const FALLBACK_FEATURES: CodeInformation = {
  ...SCRIPT_FEATURES,
  // The outline lists the declarations already, see `getDocumentSymbols`.
  structure: false,
  verification: {
    shouldReport: (_source, code) => !UNUSED_DIAGNOSTICS.has(Number(code)),
  },
};

/**
 * Added before the generated TSX. It loads the compile-time function
 * globals and selects the Solid JSX types, so no tsconfig changes are needed.
 */
const PRELUDE =
  '/// <reference types="solid-sfc/client" />\n/** @jsxImportSource @solidjs/web */\n';

// `ts.ScriptKind.TSX` and `ts.ScriptKind.Deferred`.
const SCRIPT_KIND_TSX = 4;
const SCRIPT_KIND_DEFERRED = 7;

export interface SolidLanguagePluginOptions {
  /** Called when a file cannot be compiled, for example on a markup syntax error. */
  onError?(fileName: string, error: SFCError): void;
}

function createSnapshot(text: string): IScriptSnapshot {
  return {
    getText: (start, end) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

function getLineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') {
      offsets.push(i + 1);
    }
  }
  return offsets;
}

/**
 * Turns a high-resolution source map into Volar mappings. Each mapped
 * character becomes part of a run, and runs end where the generated or the
 * source text stops being contiguous. Generated text with no source, such as
 * inserted braces, is left unmapped.
 */
export function mappingsFromSourceMap(
  generated: string,
  source: string,
  map: SourceMap,
  shift: number,
  data: CodeInformation,
): CodeMapping[] {
  const generatedLines = getLineOffsets(generated);
  const sourceLines = getLineOffsets(source);
  const mappings: CodeMapping[] = [];
  // Generated code such as `<For` maps its first character to the block it
  // replaces. Folding and outlines from that code would not match the file.
  const replaced: CodeInformation = { ...data, structure: false };
  let run: { source: number; generated: number; length: number; data: CodeInformation } | undefined;

  const flush = (): void => {
    if (run) {
      mappings.push({
        sourceOffsets: [run.source],
        generatedOffsets: [run.generated + shift],
        lengths: [run.length],
        data: run.data,
      });
      run = undefined;
    }
  };

  decode(map.mappings).forEach((segments, line) => {
    for (const segment of segments) {
      if (segment.length < 4) {
        continue;
      }
      const generatedOffset = generatedLines[line]! + segment[0];
      const sourceOffset = sourceLines[segment[2]!]! + segment[3]!;
      const charData = generated[generatedOffset] === source[sourceOffset] ? data : replaced;
      if (
        run &&
        run.data === charData &&
        run.generated + run.length === generatedOffset &&
        run.source + run.length === sourceOffset
      ) {
        run.length++;
      } else {
        flush();
        run = { source: sourceOffset, generated: generatedOffset, length: 1, data: charData };
      }
    }
  });
  flush();
  return mappings;
}

/**
 * Finds `<script>` and `<style>` blocks without parsing the markup. A block
 * at the top level starts a line. An indented `<script>` is a script of a
 * control flow block, which only runs inside the markup.
 */
function findBlocks(source: string, tag: 'script' | 'style') {
  const blocks: { attributes: string; start: number; end: number }[] = [];
  const pattern = new RegExp(`^<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'gm');
  for (const match of source.matchAll(pattern)) {
    const start = match.index + match[0].indexOf('>') + 1;
    blocks.push({ attributes: match[1] ?? '', start, end: start + match[2]!.length });
  }
  return blocks;
}

/**
 * Generated TSX for a file whose markup cannot be compiled. Only the scripts
 * are kept, so the script still gets type information while the markup has
 * an error.
 */
function createFallbackScript(source: string): VirtualCode {
  let code = PRELUDE;
  const mappings: CodeMapping[] = [];
  for (const block of findBlocks(source, 'script')) {
    mappings.push({
      sourceOffsets: [block.start],
      generatedOffsets: [code.length],
      lengths: [block.end - block.start],
      data: FALLBACK_FEATURES,
    });
    // Markup in the script is masked, since it is not JSX.
    code += `${maskScriptMarkup(source.slice(block.start, block.end))}\n`;
  }
  code += 'export default function Component() {\n  return null;\n}\n';
  return {
    id: 'tsx',
    languageId: 'typescriptreact',
    snapshot: createSnapshot(code),
    mappings,
  };
}

/**
 * Replaces `${...}` interpolations with placeholders of the same length.
 * `lineComments` is true for SCSS and Less, which have `//` comments.
 */
function maskInterpolations(css: string, lineComments: boolean): string {
  let result = '';
  let i = 0;
  while (i < css.length) {
    const comment = css.startsWith('/*', i)
      ? css.indexOf('*/', i + 2) + 2
      : lineComments && css.startsWith('//', i) && css[i - 1] !== ':'
        ? css.indexOf('\n', i)
        : undefined;
    if (comment !== undefined) {
      const next = comment <= i ? css.length : comment;
      result += css.slice(i, next);
      i = next;
    } else if (css[i] === '$' && css[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < css.length && depth > 0) {
        if (css[j] === '{') {
          depth++;
        } else if (css[j] === '}') {
          depth--;
        }
        j++;
      }
      // An identifier keeps the declaration valid CSS.
      result += 'x'.padEnd(j - i, '_');
      i = j;
    } else {
      result += css[i];
      i++;
    }
  }
  return result;
}

function createStyleCodes(source: string): VirtualCode[] {
  return findBlocks(source, 'style').map((block, index) => {
    const lang = /\blang\s*=\s*["'](scss|less)["']/.exec(block.attributes)?.[1] ?? 'css';
    return {
      id: `style_${index}`,
      languageId: lang,
      snapshot: createSnapshot(
        maskInterpolations(source.slice(block.start, block.end), lang !== 'css'),
      ),
      mappings: [
        {
          sourceOffsets: [block.start],
          generatedOffsets: [0],
          lengths: [block.end - block.start],
          data: ALL_FEATURES,
        },
      ],
    };
  });
}

function createScriptCode(
  fileName: string,
  source: string,
  options: SolidLanguagePluginOptions,
): VirtualCode {
  const { result, error } = compileForEditor(source, fileName);
  if (error) {
    options.onError?.(fileName, error);
  }
  if (result) {
    return {
      id: 'tsx',
      languageId: 'typescriptreact',
      snapshot: createSnapshot(PRELUDE + result.code),
      mappings: [
        ...mappingsFromSourceMap(result.code, source, result.map, PRELUDE.length, SCRIPT_FEATURES),
        // Errors on generated text, such as the props of blocks, are
        // reported on the source it comes from.
        ...result.generated.map((text): CodeMapping => ({
          sourceOffsets: [text.sourceOffset],
          generatedOffsets: [text.generatedOffset + PRELUDE.length],
          lengths: [text.sourceLength],
          generatedLengths: [text.generatedLength],
          data: { verification: true },
        })),
      ],
    };
  }
  return createFallbackScript(source);
}

export function createSolidVirtualCode(
  fileName: string,
  snapshot: IScriptSnapshot,
  options: SolidLanguagePluginOptions = {},
): VirtualCode {
  const source = snapshot.getText(0, snapshot.getLength());
  return {
    id: 'root',
    languageId: LANGUAGE_ID,
    snapshot,
    mappings: [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [source.length],
        data: ALL_FEATURES,
      },
    ],
    embeddedCodes: [createScriptCode(fileName, source, options), ...createStyleCodes(source)],
  };
}

function getFileName(scriptId: unknown): string {
  return typeof scriptId === 'string' ? scriptId : String(scriptId);
}

/** The Volar language plugin for `.solid` files. */
export function createSolidLanguagePlugin<T>(
  options: SolidLanguagePluginOptions = {},
  asFileName: (scriptId: T) => string = getFileName,
): LanguagePlugin<T> {
  return {
    getLanguageId(scriptId) {
      return asFileName(scriptId).endsWith(EXTENSION) ? LANGUAGE_ID : undefined;
    },
    createVirtualCode(scriptId, languageId, snapshot) {
      if (languageId === LANGUAGE_ID) {
        return createSolidVirtualCode(asFileName(scriptId), snapshot, options);
      }
      return undefined;
    },
    updateVirtualCode(scriptId, _virtualCode, snapshot) {
      return createSolidVirtualCode(asFileName(scriptId), snapshot, options);
    },
    typescript: {
      extraFileExtensions: [
        { extension: 'solid', isMixedContent: true, scriptKind: SCRIPT_KIND_DEFERRED },
      ],
      getServiceScript(root): TypeScriptServiceScript | undefined {
        const code = root.embeddedCodes?.find((embedded) => embedded.id === 'tsx');
        return code ? { code, extension: '.tsx', scriptKind: SCRIPT_KIND_TSX } : undefined;
      },
    },
  };
}

export interface FoldingRange {
  /** Offset where the range starts. */
  start: number;
  /** Offset of the last character to hide. Its line is the last folded line. */
  end: number;
  kind?: 'comment';
}

/**
 * Finds the parts of a `.solid` file that editors can fold: `<script>` and
 * `<style>` blocks, control flow blocks and comments in the markup. The
 * embedded TypeScript and CSS add the folding ranges inside them.
 */
export function getFoldingRanges(source: string): FoldingRange[] {
  const ranges: FoldingRange[] = [];
  // Closing tags and braces stay visible, so a range ends at the line break
  // before them.
  const before = (close: number): number => source.lastIndexOf('\n', close - 1);
  let markup = source;
  for (const match of source.matchAll(/<(script|style)\b[^>]*>[\s\S]*?(<\/\1\s*>)/g)) {
    const close = match.index + match[0].length - match[2]!.length;
    ranges.push({ start: match.index, end: before(close) });
    // Comments inside scripts and styles are not markup comments.
    markup =
      markup.slice(0, match.index) +
      ' '.repeat(match[0].length) +
      markup.slice(match.index + match[0].length);
  }
  for (const match of markup.matchAll(/<!--[\s\S]*?-->/g)) {
    ranges.push({ start: match.index, end: match.index + match[0].length - 3, kind: 'comment' });
  }
  // With a syntax error, the blocks outside the broken part still fold.
  for (const body of compileForEditor(source).result?.bodies ?? []) {
    const end = before(body.end);
    // A block on one line does not fold.
    if (end > body.start) {
      ranges.push({ start: body.start, end });
    }
  }
  return ranges.toSorted((a, b) => a.start - b.start);
}

export type SymbolKind =
  | 'module'
  | 'function'
  | 'variable'
  | 'constant'
  | 'class'
  | 'interface'
  | 'enum';

/** An entry of the outline of a `.solid` file. Offsets are in the file. */
export interface DocumentSymbol {
  name: string;
  kind: SymbolKind;
  start: number;
  end: number;
  /** The range of the name. */
  selectionStart: number;
  selectionEnd: number;
  children: DocumentSymbol[];
}

interface Span {
  start: number;
  end: number;
}

interface Declaration extends Span {
  type: string;
  id?: (Span & { name?: string; type: string }) | null;
  kind?: string;
  declarations?: (Span & { id: Span & { type: string; name?: string } })[];
  declaration?: Declaration | null;
}

const DECLARATION_KINDS: Record<string, SymbolKind> = {
  FunctionDeclaration: 'function',
  ClassDeclaration: 'class',
  TSInterfaceDeclaration: 'interface',
  TSTypeAliasDeclaration: 'interface',
  TSEnumDeclaration: 'enum',
};

/** The top-level declarations of a script, such as functions and variables. */
function getScriptSymbols(code: string, offset: number): DocumentSymbol[] {
  // Scripts are always TypeScript, with or without `lang`. Their markup is
  // masked, since it is not JSX.
  const { program } = parseSync('script.ts', maskScriptMarkup(code), {
    lang: 'ts',
    sourceType: 'module',
  });
  const symbols: DocumentSymbol[] = [];
  const add = (name: string, kind: SymbolKind, node: Span, id: Span): void => {
    symbols.push({
      name,
      kind,
      start: offset + node.start,
      end: offset + node.end,
      selectionStart: offset + id.start,
      selectionEnd: offset + id.end,
      children: [],
    });
  };
  const visit = (node: Declaration): void => {
    const name = node.id?.name;
    const kind = DECLARATION_KINDS[node.type];
    if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
      if (node.declaration) {
        visit(node.declaration);
      }
    } else if (kind && name && node.id) {
      add(name, kind, node, node.id);
    } else if (node.type === 'VariableDeclaration') {
      for (const declarator of node.declarations ?? []) {
        // Destructuring patterns are listed by their whole pattern.
        const id = declarator.id;
        const label = id.type === 'Identifier' ? id.name! : code.slice(id.start, id.end);
        add(label, node.kind === 'const' ? 'constant' : 'variable', declarator, id);
      }
    }
  };
  for (const node of program.body as unknown as Declaration[]) {
    visit(node);
  }
  return symbols;
}

/**
 * Lists the `<script>` blocks of a `.solid` file with their top-level
 * declarations, the `<style>` blocks and the `#template` declarations. CSS
 * adds its rules to the style blocks. The declarations come from here,
 * because TypeScript sees them inside the generated component function,
 * which has no place in the file.
 */
export function getDocumentSymbols(source: string): DocumentSymbol[] {
  const symbols: DocumentSymbol[] = [];
  // Top-level blocks start a line. Indented scripts belong to control flow blocks.
  for (const match of source.matchAll(/^<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gm)) {
    const [whole, tag, attributes = '', content = ''] = match;
    const name = `<${tag}${attributes.replace(/\s+/g, ' ').trimEnd()}>`;
    const contentStart = match.index + whole.indexOf('>') + 1;
    symbols.push({
      name,
      kind: 'module',
      start: match.index,
      end: match.index + whole.length,
      selectionStart: match.index,
      selectionEnd: match.index + tag!.length + 1,
      children: tag === 'script' ? getScriptSymbols(content, contentStart) : [],
    });
  }
  // Templates are found in the markup only, not in scripts and styles.
  let markup = source;
  for (const symbol of symbols) {
    markup =
      markup.slice(0, symbol.start) +
      ' '.repeat(symbol.end - symbol.start) +
      markup.slice(symbol.end);
  }
  for (const match of markup.matchAll(/(?<![\w$])#template\s+([A-Za-z_$][\w$]*)\s*\(/g)) {
    const nameStart = match.index + match[0].indexOf(match[1]!);
    symbols.push({
      name: match[1]!,
      kind: 'function',
      start: match.index,
      end: match.index + match[0].length,
      selectionStart: nameStart,
      selectionEnd: nameStart + match[1]!.length,
      children: [],
    });
  }
  return symbols.toSorted((a, b) => a.start - b.start);
}

// HTML elements that never have children.
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

/**
 * Returns the closing tag to insert after `>` at `offset - 1` ends an opening
 * tag in the markup, such as `</div>` for `<div class="a">`, or undefined.
 */
export function getClosingTag(source: string, offset: number): string | undefined {
  if (source[offset - 1] !== '>' || source[offset - 2] === '/') {
    return undefined;
  }
  // Scripts and styles are not markup.
  for (const match of source.matchAll(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/g)) {
    const contentStart = match.index + match[0].indexOf('>') + 1;
    if (offset > contentStart && offset <= match.index + match[0].length) {
      return undefined;
    }
  }
  if (source[offset - 2] === '<') {
    return '</>';
  }
  // The nearest `<name` before the `>`, outside of quotes and brackets.
  let depth = 0;
  let quote: string | undefined;
  for (let i = offset - 2; i >= 0; i--) {
    const char = source[i]!;
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth++;
    } else if (char === '(' || char === '[' || char === '{') {
      depth--;
    } else if (char === '>' && depth === 0) {
      return undefined;
    } else if (char === '<' && depth === 0) {
      // A dynamic tag `<{tag}>` closes like a fragment.
      if (source[i + 1] === '{') {
        return '</>';
      }
      const name = /^[A-Za-z][\w$.:-]*/.exec(source.slice(i + 1))?.[0];
      if (
        !name ||
        VOID_ELEMENTS.has(name) ||
        name === 'solid:window' ||
        name === 'solid:document'
      ) {
        return undefined;
      }
      return `</${name}>`;
    }
  }
  return undefined;
}

export { getCodeActions, getCompletions } from './editing.ts';
export { compileForEditor } from './recovery.ts';
export type { CodeAction, Completion, TextEdit } from './editing.ts';
