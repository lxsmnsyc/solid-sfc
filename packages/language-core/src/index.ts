import { decode } from '@jridgewell/sourcemap-codec';
import type {
  CodeInformation,
  CodeMapping,
  IScriptSnapshot,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptServiceScript } from '@volar/typescript';
import { SFCError, compileStructure } from 'solid-sfc';
import type { SourceMap } from 'solid-sfc';

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
  let run: { source: number; generated: number; length: number } | undefined;

  const flush = (): void => {
    if (run) {
      mappings.push({
        sourceOffsets: [run.source],
        generatedOffsets: [run.generated + shift],
        lengths: [run.length],
        data,
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
      if (
        run &&
        run.generated + run.length === generatedOffset &&
        run.source + run.length === sourceOffset
      ) {
        run.length++;
      } else {
        flush();
        run = { source: sourceOffset, generated: generatedOffset, length: 1 };
      }
    }
  });
  flush();
  return mappings;
}

/** Finds `<script>` and `<style>` blocks without parsing the markup. */
function findBlocks(source: string, tag: 'script' | 'style') {
  const blocks: { attributes: string; start: number; end: number }[] = [];
  const pattern = new RegExp(`<${tag}(\\s[^>]*)?>([\\s\\S]*?)</${tag}\\s*>`, 'g');
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
    code += `${source.slice(block.start, block.end)}\n`;
  }
  code += 'export default function Component() {\n  return null;\n}\n';
  return {
    id: 'tsx',
    languageId: 'typescriptreact',
    snapshot: createSnapshot(code),
    mappings,
  };
}

/** Replaces `${...}` interpolations with placeholders of the same length. */
function maskInterpolations(css: string): string {
  let result = '';
  let i = 0;
  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      const next = end === -1 ? css.length : end + 2;
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
  return findBlocks(source, 'style').map((block, index) => ({
    id: `style_${index}`,
    languageId: 'css',
    snapshot: createSnapshot(maskInterpolations(source.slice(block.start, block.end))),
    mappings: [
      {
        sourceOffsets: [block.start],
        generatedOffsets: [0],
        lengths: [block.end - block.start],
        data: ALL_FEATURES,
      },
    ],
  }));
}

function createScriptCode(
  fileName: string,
  source: string,
  options: SolidLanguagePluginOptions,
): VirtualCode {
  try {
    const result = compileStructure(source, { filename: fileName });
    return {
      id: 'tsx',
      languageId: 'typescriptreact',
      snapshot: createSnapshot(PRELUDE + result.code),
      mappings: mappingsFromSourceMap(
        result.code,
        source,
        result.map,
        PRELUDE.length,
        SCRIPT_FEATURES,
      ),
    };
  } catch (error) {
    if (!(error instanceof SFCError)) {
      throw error;
    }
    options.onError?.(fileName, error);
    return createFallbackScript(source);
  }
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
