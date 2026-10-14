import remapping from '@jridgewell/remapping';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { Bundle, MagicString } from 'magic-string';
import { KEY_IDENTIFIER } from './control.ts';
import { SFCError } from './error.ts';
import { CompileError, compile as compileLabels } from './labels/index.ts';
import { PROPS_IDENTIFIER, analyzeInstanceScript, analyzeModuleScript } from './script.ts';
import type { SourceMap } from './style.ts';
import { getScopeAttribute, getVariableName, hash, processStyles } from './style.ts';
import type { Block, Range, TemplateScope } from './template.ts';
import { TemplateParser } from './template.ts';

export type { SourceMap };

export interface CompileOptions {
  /** Used for error messages, the source map and the component name. */
  filename?: string;
  /**
   * Identifies the component in scoped styles. It must be unique and stable
   * across builds. Defaults to a hash of `filename`.
   */
  scope?: string;
  /** Adds debug names to signals and memos. */
  dev?: boolean;
}

export interface CompileResult {
  /** TSX code. Compile-time functions are already replaced. */
  code: string;
  map: SourceMap;
  /** The stylesheet of the component, if it has `<style>` blocks. */
  css: { code: string; map: SourceMap } | undefined;
}

export interface StructureResult extends CompileResult {}

const VARIABLES_IDENTIFIER = '__styleVariables';
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
 * functions. Type-checking uses this code, because the global declarations
 * of the compile-time functions already describe it.
 */
export function compileStructure(source: string, options: CompileOptions = {}): StructureResult {
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
  const templateScope: TemplateScope | undefined = css?.scoped
    ? {
        attribute: getScopeAttribute(scope),
        variables: css.variables.length > 0 ? VARIABLES_IDENTIFIER : undefined,
        mergeStyle: MERGE_STYLE_IDENTIFIER,
      }
    : undefined;

  const output = new MagicString(source, { filename });
  const { markup, mergesStyle, usesKey } = new TemplateParser(
    source,
    output,
    fail,
    templateScope,
  ).parse();

  const bundle = new Bundle({ separator: '\n' });
  const addRange = (start: number, end: number, edit?: (snip: MagicString) => void): void => {
    const snip = output.snip(start, end);
    edit?.(snip);
    // Sources without a name get no mappings.
    bundle.addSource({ filename: filename ?? 'component.solid', content: snip });
  };
  const addText = (text: string): void => {
    bundle.addSource({ content: new MagicString(text) });
  };

  if (module) {
    analyzeModuleScript(
      source.slice(module.contentStart, module.contentEnd),
      module.contentStart,
      fail,
    );
    addRange(module.contentStart, module.contentEnd);
  }

  let parameters = '';
  let generics = '';
  let hoisted: Range[] = [];
  if (instance) {
    const analysis = analyzeInstanceScript(
      source.slice(instance.contentStart, instance.contentEnd),
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
    for (const range of hoisted) {
      addRange(range.start, range.end);
    }
    // Unused props get no parameter, so `noUnusedParameters` does not report it.
    if (analysis.propsCalls.length > 0) {
      parameters = `${PROPS_IDENTIFIER}: ${analysis.propsType ?? 'Record<string, any>'}`;
    }
    const { generics: value } = instance.attributes;
    if (typeof value === 'string') {
      generics = `<${value}>`;
    }
  }

  if (usesKey) {
    addText(`import { key as ${KEY_IDENTIFIER} } from 'solid-sfc/runtime';`);
  }
  if (mergesStyle) {
    addText(`import { mergeStyle as ${MERGE_STYLE_IDENTIFIER} } from 'solid-sfc/runtime';`);
  }

  addText(`export default function ${getComponentName(filename)}${generics}(${parameters}) {`);

  if (instance) {
    addRange(instance.contentStart, instance.contentEnd, (snip) => {
      for (const range of hoisted) {
        snip.remove(range.start, range.end);
      }
    });
  }

  if (templateScope?.variables && css) {
    addText(`const ${VARIABLES_IDENTIFIER} = () => ({`);
    css.variables.forEach((variable, index) => {
      // Text around the interpolation joins the value as a template literal.
      // It only has CSS token characters, so it needs no escaping.
      const joined = variable.prefix || variable.suffix;
      addText(`'${getVariableName(scope, index)}': ${joined ? `\`${variable.prefix}\${` : ''}(`);
      addRange(variable.start, variable.end);
      addText(`)${joined ? `}${variable.suffix}\`` : ''},`);
    });
    addText('});');
  }

  addText('return (<>');
  for (const range of markup) {
    addRange(range.start, range.end);
  }
  addText('</>);\n}');

  return {
    code: bundle.toString(),
    map: bundle.generateMap({ hires: true, includeContent: true, file: filename }) as SourceMap,
    css: css && { code: css.code, map: css.map },
  };
}

/** Compiles a `.solid` file into a TSX module. */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const fail = createFail(source, options.filename);
  const { code: structure, map: structureMap, css } = compileStructure(source, options);

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
  const map = remapping(ctf.map as never, (file) =>
    file === 'structure.tsx' ? (structureMap as never) : null,
  );

  return {
    code: ctf.code,
    map: { ...map, version: 3, file: options.filename } as SourceMap,
    css: css && { code: css.code, map: css.map },
  };
}
