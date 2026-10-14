import { Bundle, MagicString } from 'magic-string';
import { SFCError } from './error.ts';
import { Scanner } from './scanner.ts';
import { PROPS_IDENTIFIER, analyzeInstanceScript, analyzeModuleScript } from './script.ts';
import type { Block, Range } from './template.ts';
import { TemplateParser } from './template.ts';

export interface CompileOptions {
  /** Used for error messages, the source map and the component name. */
  filename?: string;
}

export interface CompileResult {
  /** TSX code. It still uses `solid-labels` and `solid-styled` syntax. */
  code: string;
  map: ReturnType<Bundle['generateMap']>;
  /** True if the component has `<style>` blocks. */
  hasStyles: boolean;
}

const CSS_IDENTIFIER = '__css';

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

/**
 * Escapes a `<style>` body so it can be placed in a template literal.
 * `${...}` interpolations are kept, so styles can use reactive values.
 */
function escapeStyle(output: MagicString, scanner: Scanner, block: Block): void {
  const { source } = scanner;
  let i = block.contentStart;
  while (i < block.contentEnd) {
    const char = source[i];
    if (char === '$' && source[i + 1] === '{') {
      i = scanner.scanExpression(i + 2, '}') + 1;
    } else {
      if (char === '\\' || char === '`') {
        output.prependRight(i, '\\');
      }
      i++;
    }
  }
}

/** Compiles a `.solid` file into a TSX module. */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
  const { filename } = options;
  const fail = (message: string, offset: number): never => {
    throw new SFCError(message, source, offset, filename);
  };

  const output = new MagicString(source, { filename });
  const { blocks, markup } = new TemplateParser(source, output, fail).parse();

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

  const bundle = new Bundle({ separator: '\n' });
  const addRange = (start: number, end: number, edit?: (snip: MagicString) => void): void => {
    const snip = output.snip(start, end);
    edit?.(snip);
    bundle.addSource({ filename, content: snip });
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

  if (styles.length > 0) {
    addText(`import { css as ${CSS_IDENTIFIER} } from 'solid-styled';`);
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

  const scanner = new Scanner(source, {
    error: fail,
    element: (offset) => fail('Unexpected element in a style interpolation', offset),
  });
  for (const style of styles) {
    escapeStyle(output, scanner, style);
    const global = style.attributes.global === true;
    addText(`${CSS_IDENTIFIER}\`${global ? '@global {' : ''}`);
    addRange(style.contentStart, style.contentEnd);
    addText(`${global ? '}' : ''}\`;`);
  }

  addText('return (<>');
  for (const range of markup) {
    addRange(range.start, range.end);
  }
  addText('</>);\n}');

  return {
    code: bundle.toString(),
    map: bundle.generateMap({ hires: true, includeContent: true, file: filename }),
    hasStyles: styles.length > 0,
  };
}
