import remapping from '@jridgewell/remapping';
import { TraceMap, generatedPositionFor, originalPositionFor } from '@jridgewell/trace-mapping';
import { Bundle, MagicString } from 'magic-string';
import { KEY_IDENTIFIER } from './control.ts';
import { checkAccessibility } from './a11y.ts';
import { SFCError, createWarning } from './error.ts';
import type { SFCWarning } from './error.ts';
import { CompileError, compile as compileLabels } from './labels/index.ts';
import { declareImportsLocally, localizeImports, writeImports } from './imports.ts';
import type { ImportInfo } from './imports.ts';
import {
  PROPS_IDENTIFIER,
  analyzeInstanceScript,
  analyzeModuleScript,
  maskMarkup,
} from './script.ts';
import type { SourceMap } from './style.ts';
import { layout } from './layout.ts';
import { minifyCSS } from './minify.ts';
import { getScopeAttribute, getVariableName, hash, processStyles } from './style.ts';
import type { ScopedSelector, StyleLang } from './style.ts';
import type { Block, ElementInfo, GeneratedText, Range, TemplateScope } from './template.ts';
import { DYNAMIC_IDENTIFIER, LISTEN_IDENTIFIER, TemplateParser } from './template.ts';

export type { SourceMap };

export interface CompileOptions {
  /** Used for error messages, the source map and the component name. */
  filename?: string;
  /**
   * Identifies the component in scoped styles. It must be unique and stable
   * across builds. Defaults to a hash of `filename`.
   */
  scope?: string;
  /**
   * Adds debug names to signals and memos, and keeps the stylesheet as it is
   * written. Otherwise the stylesheet is minified.
   */
  dev?: boolean;
  /**
   * Returns a module whose default export is the stylesheet of the
   * component, as a string, for the language of its `<style>` blocks. The
   * component imports its stylesheet from it instead of holding the CSS, so
   * the bundler can process the CSS, such as compiling Sass. Bundler plugins
   * set it.
   */
  stylesheet?: (lang: StyleLang) => string;
}

export interface CompileResult {
  /** TSX code. Compile-time functions are already replaced. */
  code: string;
  map: SourceMap;
  /** The stylesheet of the component, if it has `<style>` blocks. */
  css: { code: string; map: SourceMap; lang: StyleLang } | undefined;
  /** Problems that do not stop compiling, such as unused CSS selectors. */
  warnings: SFCWarning[];
}

/**
 * Maps text that the compiler generates to the source it comes from, such as
 * the `each` prop of `#for` to its list. TypeScript reports some errors on
 * this text, which has no place in the source.
 */
export interface GeneratedMapping {
  generatedOffset: number;
  generatedLength: number;
  sourceOffset: number;
  sourceLength: number;
}

export interface StructureOptions extends CompileOptions {
  /**
   * Writes `#if` as conditional expressions instead of `<Show>`, so
   * TypeScript narrows values inside its branches. Editors set it.
   */
  typeCheck?: boolean;
}

export interface StructureResult extends CompileResult {
  generated: GeneratedMapping[];
  /** The bodies of control flow blocks, from `{` to `}`. Editors fold them. */
  bodies: Range[];
}

const VARIABLES_IDENTIFIER = '__styleVariables';
const STYLESHEET_IDENTIFIER = '__stylesheet';
const USE_STYLE_IDENTIFIER = '__useStyle';
const MERGE_STYLE_IDENTIFIER = '__mergeStyle';

function getComponentName(filename: string | undefined): string {
  const base = filename?.split(/[\\/]/).pop()?.split('.')[0] ?? '';
  const name = base
    .split(/[^A-Za-z0-9_$]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
  if (!name || /^[0-9]/.test(name)) {
    return `Component${name}`;
  }
  return name;
}

function createFail(source: string, filename: string | undefined) {
  return (message: string, offset: number): never => {
    throw new SFCError(message, source, offset, filename);
  };
}

/**
 * Compiles a `.solid` file into a TSX module, without replacing compile-time
 * functions. Type-checking uses this code, with `typeCheck`, because the
 * global declarations of the compile-time functions already describe it.
 */
export function compileStructure(source: string, options: StructureOptions = {}): StructureResult {
  const { filename } = options;
  const fail = createFail(source, filename);

  // The first pass finds the blocks. Scoping the markup needs the styles.
  const { blocks } = new TemplateParser(source, new MagicString(source), fail).parse();

  let instance: Block | undefined;
  let module: Block | undefined;
  const styles: Block[] = [];
  for (const block of blocks) {
    if (block.type === 'style') {
      styles.push(block);
    } else if ('module' in block.attributes) {
      if (module) {
        fail('A component can only have one <script module>', block.start);
      }
      module = block;
    } else {
      if (instance) {
        fail('A component can only have one <script>', block.start);
      }
      instance = block;
    }
  }

  const scope = options.scope ?? hash(filename ?? source);
  const css =
    styles.length > 0
      ? processStyles({ source, blocks: styles, scope, filename, fail })
      : undefined;
  // The stylesheet of the file has the name of its scope, even when no
  // style is scoped.
  const styleId = getScopeAttribute(scope);
  const templateScope: TemplateScope | undefined = css?.scoped
    ? {
        attribute: getScopeAttribute(scope),
        variables: css.variables.length > 0 ? VARIABLES_IDENTIFIER : undefined,
        mergeStyle: MERGE_STYLE_IDENTIFIER,
      }
    : undefined;

  const output = new MagicString(source, { filename });
  const {
    markup,
    mergesStyle,
    usesKey,
    usesListen,
    usesDynamic,
    scriptMarkup,
    blockImports,
    generated,
    bodies,
    templates,
    elements,
  } = new TemplateParser(source, output, fail, templateScope, options.typeCheck).parse();

  const written: ImportInfo[] = [];
  if (module) {
    written.push(
      ...analyzeModuleScript(
        maskMarkup(source, module.contentStart, module.contentEnd, scriptMarkup),
        module.contentStart,
        fail,
      ),
    );
  }

  let parameters = '';
  let generics = '';
  let hoisted: Range[] = [];
  if (instance) {
    const analysis = analyzeInstanceScript(
      maskMarkup(source, instance.contentStart, instance.contentEnd, scriptMarkup),
      instance.contentStart,
      fail,
    );
    for (const call of analysis.propsCalls) {
      // Destructured props stay reactive through `$destructure`.
      output.update(
        call.start,
        call.end,
        call.destructured ? `$destructure(${PROPS_IDENTIFIER})` : PROPS_IDENTIFIER,
      );
    }
    hoisted = analysis.hoisted;
    written.push(...analysis.imports);
    // Unused props get no parameter, so `noUnusedParameters` does not report it.
    if (analysis.propsCalls.length > 0) {
      parameters = `${PROPS_IDENTIFIER}: ${analysis.propsType ?? 'Record<string, any>'}`;
    }
    const { generics: value } = instance.attributes;
    if (typeof value === 'string') {
      generics = `<${value}>`;
    }
  }

  /**
   * Builds the module from `out`. With `hoistBlockImports`, the imports of
   * block scripts move to the top of the module. Without, they stay where
   * they are, for the scope analysis of `localizeImports`.
   */
  const assemble = (out: MagicString, hoistBlockImports: boolean) => {
    const bundle = new Bundle({ separator: '\n' });
    // `inline` continues the line of the previous part.
    const addRange = (
      start: number,
      end: number,
      edit?: (snip: MagicString) => void,
      inline = false,
    ): void => {
      const snip = out.snip(start, end);
      edit?.(snip);
      // Sources without a name get no mappings.
      bundle.addSource({
        filename: filename ?? 'component.solid',
        content: snip,
        separator: inline ? '' : '\n',
      });
    };
    const addText = (text: string, inline = false): void => {
      bundle.addSource({ content: new MagicString(text), separator: inline ? '' : '\n' });
    };
    // Removes the block imports that are in a range of the markup.
    const addMarkup = (range: Range): void => {
      addRange(range.start, range.end, (snip) => {
        if (!hoistBlockImports) {
          return;
        }
        for (const info of blockImports) {
          if (info.start >= range.start && info.end <= range.end) {
            snip.remove(info.start, info.end);
          }
        }
      });
    };

    if (module) {
      addRange(module.contentStart, module.contentEnd);
    }
    for (const range of hoisted) {
      addRange(range.start, range.end);
    }
    if (hoistBlockImports) {
      writeImports(
        blockImports,
        written,
        (start, end, inline) => addRange(start, end, undefined, inline),
        addText,
      );
    }

    // The editor does not need the stylesheet.
    const sheet = css && !options.typeCheck;
    const runtime = [
      sheet && `useStyle as ${USE_STYLE_IDENTIFIER}`,
      usesKey && `key as ${KEY_IDENTIFIER}`,
      usesListen && `listen as ${LISTEN_IDENTIFIER}`,
      mergesStyle && `mergeStyle as ${MERGE_STYLE_IDENTIFIER}`,
    ].filter(Boolean);
    if (runtime.length > 0) {
      addText(`import { ${runtime.join(', ')} } from 'solid-sfc/runtime';`);
    }
    if (usesDynamic) {
      addText(`import { dynamic as ${DYNAMIC_IDENTIFIER} } from '@solidjs/web';`);
    }

    if (sheet) {
      addText(
        options.stylesheet
          ? `import ${STYLESHEET_IDENTIFIER} from ${JSON.stringify(options.stylesheet(css.lang))};`
          : `const ${STYLESHEET_IDENTIFIER} = ${JSON.stringify(
              // Only CSS can be minified here. A bundler compiles the other languages.
              options.dev || css.lang !== 'css' ? css.code : minifyCSS(css.code),
            )};`,
      );
    }

    addText(`export default function ${getComponentName(filename)}${generics}(${parameters}) {`);
    if (sheet) {
      // The stylesheet is in the document while the component is rendered.
      addText(`  ${USE_STYLE_IDENTIFIER}(${JSON.stringify(styleId)}, ${STYLESHEET_IDENTIFIER});`);
    }

    // The variables come first, because markup in the script can use them
    // while the script runs.
    if (templateScope?.variables && css) {
      addText(`  const ${VARIABLES_IDENTIFIER} = () => ({`);
      css.variables.forEach((variable, index) => {
        // Text around the interpolation joins the value as a template literal.
        // It only has CSS token characters, so it needs no escaping.
        const joined = variable.prefix || variable.suffix;
        addText(
          `    '${getVariableName(scope, index)}': ${joined ? `\`${variable.prefix}\${` : ''}(`,
        );
        addRange(variable.start, variable.end, undefined, true);
        addText(`)${joined ? `}${variable.suffix}\`` : ''},`, true);
      });
      addText('  });');
    }

    if (instance) {
      addRange(instance.contentStart, instance.contentEnd, (snip) => {
        for (const range of hoisted) {
          snip.remove(range.start, range.end);
        }
      });
    }

    for (const range of templates) {
      addMarkup(range);
    }

    addText('  return (\n    <>');
    for (const range of markup) {
      addMarkup(range);
    }
    addText('    </>\n  );\n}');

    return {
      code: bundle.toString(),
      map: bundle.generateMap({
        hires: true,
        includeContent: true,
        file: filename,
      }) as SourceMap,
    };
  };

  if (blockImports.length > 0) {
    // A copy declares the block imports in place, so the scope analysis sees
    // where each one is used.
    const copy = output.clone();
    declareImportsLocally(copy, blockImports);
    const analysis = assemble(copy, false);
    const renames = localizeImports({
      source,
      code: analysis.code,
      map: analysis.map,
      imports: blockImports,
      written,
    });
    for (const rename of renames) {
      output.update(rename.start, rename.end, rename.text);
    }
  }

  const { code, map } = assemble(output, true);
  return {
    code,
    map,
    css: css && { code: css.code, map: css.map, lang: css.lang },
    warnings: [
      ...findUnusedSelectors(source, css?.selectors ?? [], elements),
      ...checkAccessibility(source, elements),
      // Only a bundler can compile Sass and Less.
      ...(css && css.lang !== 'css' && !options.stylesheet && !options.typeCheck
        ? [
            createWarning(
              'css-preprocessor',
              `<style lang="${css.lang}"> is only compiled by a bundler plugin. The stylesheet is used as it is.`,
              source,
              styles[0]!.start,
              '<style'.length,
            ),
          ]
        : []),
    ].toSorted((a, b) => a.offset - b.offset),
    generated: mapGenerated(code, map, source, generated),
    bodies,
  };
}

/** True if the scoped part of a selector can match an element. */
function matches(selector: ScopedSelector, element: ElementInfo): boolean {
  return (
    (selector.tag === undefined ||
      selector.tag === '*' ||
      element.dynamicTag ||
      selector.tag === element.tag) &&
    (element.dynamicClass || selector.classes.every((name) => element.classes.has(name))) &&
    (element.dynamicId || selector.ids.every((name) => element.ids.has(name)))
  );
}

/**
 * Warns about scoped selectors that no element of the markup can match. Only
 * the scoped part of a selector is checked, because the rest can match the
 * elements of other components.
 */
function findUnusedSelectors(
  source: string,
  selectors: ScopedSelector[],
  elements: ElementInfo[],
): SFCWarning[] {
  return selectors
    .filter((selector) => !elements.some((element) => matches(selector, element)))
    .map((selector) =>
      createWarning(
        'css-unused-selector',
        `Unused CSS selector "${selector.text}"`,
        source,
        selector.offset,
        selector.text.length,
      ),
    );
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

/** Finds each generated text in the output, next to the copy of its anchor. */
function mapGenerated(
  code: string,
  map: SourceMap,
  source: string,
  texts: GeneratedText[],
): GeneratedMapping[] {
  if (texts.length === 0) {
    return [];
  }
  const tracer = new TraceMap(map as never);
  const [file] = map.sources;
  const sourceLines = getLineOffsets(source);
  const codeLines = getLineOffsets(code);
  const mappings: GeneratedMapping[] = [];
  for (const text of texts) {
    let line = 0;
    while (line + 1 < sourceLines.length && sourceLines[line + 1]! <= text.anchor) {
      line++;
    }
    const position = generatedPositionFor(tracer, {
      source: file!,
      line: line + 1,
      column: text.anchor - sourceLines[line]!,
    });
    if (position.line === null) {
      continue;
    }
    const offset = codeLines[position.line - 1]! + position.column + text.delta;
    if (code.startsWith(text.text, offset)) {
      mappings.push({
        generatedOffset: offset,
        generatedLength: text.text.length,
        sourceOffset: text.start,
        sourceLength: text.end - text.start,
      });
    }
  }
  return mappings;
}

/** Compiles a `.solid` file into a TSX module. */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const fail = createFail(source, options.filename);
  const { code: structure, map: structureMap, css, warnings } = compileStructure(source, options);

  // Compile-time functions are replaced on the generated TSX, because the
  // markup expressions are only valid JavaScript after the first step.
  let ctf: ReturnType<typeof compileLabels>;
  try {
    ctf = compileLabels('structure.tsx', structure, { dev: options.dev });
  } catch (error) {
    if (!(error instanceof CompileError)) {
      throw error;
    }
    // Report the error at its location in the `.solid` file.
    const original = originalPositionFor(new TraceMap(structureMap as never), {
      line: error.line,
      column: error.column - 1,
    });
    const message = error.message.replace(/ \(\d+:\d+\)$/, '');
    if (original.line === null) {
      return fail(message, 0);
    }
    const lines = source.split('\n').slice(0, original.line - 1);
    return fail(
      message,
      lines.reduce((total, current) => total + current.length + 1, 0) + original.column,
    );
  }
  // The layout only changes whitespace, so a module it cannot parse stays as it is.
  const laidOut = layout(ctf.code, 'compiled.tsx');
  const map = remapping((laidOut?.map ?? ctf.map) as never, (file) =>
    file === 'compiled.tsx'
      ? (ctf.map as never)
      : file === 'structure.tsx'
        ? (structureMap as never)
        : null,
  );

  return {
    code: laidOut?.code ?? ctf.code,
    map: { ...map, version: 3, file: options.filename } as SourceMap,
    css,
    warnings,
  };
}
