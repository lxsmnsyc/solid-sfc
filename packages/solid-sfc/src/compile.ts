import remapping from '@jridgewell/remapping';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { Bundle, MagicString } from 'magic-string';
import { transformCTF } from './ctf.ts';
import { SFCError, getLocation } from './error.ts';
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
}

export interface CompileResult {
  /** TSX code. Compile-time functions are already replaced. */
  code: string;
  map: SourceMap;
  /** The stylesheet of the component, if it has `<style>` blocks. */
  css: { code: string; map: SourceMap } | undefined;
}

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

/** Compiles a `.solid` file into a TSX module. */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const { filename } = options;
  const fail = (message: string, offset: number): never => {
    throw new SFCError(message, source, offset, filename);
  };

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
  const { markup, mergesStyle } = new TemplateParser(source, output, fail, templateScope).parse();

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

  let propsType = '{}';
  let generics = '';
  let hoisted: Range[] = [];
  if (instance) {
    const analysis = analyzeInstanceScript(
      source.slice(instance.contentStart, instance.contentEnd),
      instance.contentStart,
      fail,
    );
    for (const call of analysis.propsCalls) {
      output.update(call.start, call.end, PROPS_IDENTIFIER);
    }
    hoisted = analysis.hoisted;
    for (const range of hoisted) {
      addRange(range.start, range.end);
    }
    if (analysis.propsCalls.length > 0) {
      propsType = analysis.propsType ?? 'Record<string, any>';
    }
    const { generics: value } = instance.attributes;
    if (typeof value === 'string') {
      generics = `<${value}>`;
    }
  }

  if (mergesStyle) {
    addText(`import { mergeStyle as ${MERGE_STYLE_IDENTIFIER} } from 'solid-sfc/runtime';`);
  }

  addText(
    `export default function ${getComponentName(filename)}${generics}(${PROPS_IDENTIFIER}: ${propsType}) {`,
  );

  if (instance) {
    addRange(instance.contentStart, instance.contentEnd, (snip) => {
      for (const range of hoisted) {
        snip.remove(range.start, range.end);
      }
    });
  }

  if (templateScope?.variables && css) {
    addText(`const ${VARIABLES_IDENTIFIER} = () => ({`);
    css.variables.forEach((range, index) => {
      addText(`'${getVariableName(scope, index)}': (`);
      addRange(range.start, range.end);
      addText('),');
    });
    addText('});');
  }

  addText('return (<>');
  for (const range of markup) {
    addRange(range.start, range.end);
  }
  addText('</>);\n}');

  const structure = bundle.toString();
  const structureMap = bundle.generateMap({ hires: true, includeContent: true, file: filename });

  // Compile-time functions are replaced on the generated TSX, because the
  // markup expressions are only valid JavaScript after the first step.
  const ctf = transformCTF(structure, {
    props: PROPS_IDENTIFIER,
    fail(message, offset) {
      const { line, column } = getLocation(structure, offset);
      const original = originalPositionFor(new TraceMap(structureMap as never), {
        line,
        column: column - 1,
      });
      if (original.line === null) {
        return fail(message, 0);
      }
      const lines = source.split('\n').slice(0, original.line - 1);
      return fail(
        message,
        lines.reduce((total, current) => total + current.length + 1, 0) + original.column,
      );
    },
  });
  const ctfMap = ctf.generateMap({ hires: true, source: 'structure.tsx' });
  const map = remapping(ctfMap as never, (file) =>
    file === 'structure.tsx' ? (structureMap as never) : null,
  );

  return {
    code: ctf.toString(),
    map: { ...map, version: 3, file: filename } as SourceMap,
    css: css && { code: css.code, map: css.map },
  };
}
