import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { transformWithOxc } from 'vite';
import type { Plugin } from 'vite';
import solidPlugin from '@solidjs/vite-plugin';
import type { Options as SolidPluginOptions } from '@solidjs/vite-plugin';
import { compile } from './compile.ts';
import type { CompileResult } from './compile.ts';
import { hash } from './style.ts';

export interface SolidSFCOptions {
  /** Options for `@solidjs/vite-plugin`. */
  solid?: Partial<SolidPluginOptions>;
}

const EXTENSION = '.solid';
// Vite processes the stylesheet by the extension at the end, such as `.scss`.
const STYLE_QUERY = /\?solid-sfc&type=style&lang\.(?:css|scss|less)$/;

function styleQuery(lang: string): string {
  return `?solid-sfc&type=style&lang.${lang}`;
}

function splitId(id: string): { file: string; query: string } {
  const index = id.indexOf('?');
  return index === -1
    ? { file: id, query: '' }
    : { file: id.slice(0, index), query: id.slice(index) };
}

function isSFC(id: string): boolean {
  const { file, query } = splitId(id);
  return file.endsWith(EXTENSION) && !query.includes('solid-sfc');
}

/**
 * Compiles `.solid` files. It includes `@solidjs/vite-plugin`, so do not add it
 * again.
 */
export default function solidSFC(options: SolidSFCOptions = {}): Plugin[] {
  const solidOptions = options.solid ?? {};
  let root = process.cwd();
  let dev = false;

  const compileFile = (code: string, file: string): CompileResult =>
    compile(code, {
      filename: file,
      dev,
      // The path from the root is the same on every machine.
      scope: hash(path.relative(root, file).split(path.sep).join('/')),
    });

  return [
    {
      name: 'solid-sfc',
      enforce: 'pre',
      configResolved(config) {
        root = config.root;
        dev = !config.isProduction;
      },
      resolveId(source, importer) {
        if (importer && STYLE_QUERY.test(source)) {
          return path.resolve(path.dirname(splitId(importer).file), source);
        }
        return null;
      },
      async load(id) {
        const { file, query } = splitId(id);
        if (!STYLE_QUERY.test(query)) {
          return null;
        }
        // Compile again instead of caching, so the CSS always matches the file.
        const { css } = compileFile(await readFile(file, 'utf8'), file);
        return css ? { code: css.code, map: css.map } : '';
      },
      transform(code, id) {
        if (!isSFC(id)) {
          return null;
        }
        const { file } = splitId(id);
        const result = compileFile(code, file);
        for (const warning of result.warnings) {
          const location = `${path.relative(root, file)}:${warning.line}:${warning.column}`;
          this.warn(`${warning.code}: ${warning.message} (${location})`);
        }
        let output = result.code;
        if (result.css) {
          const style = `./${path.basename(file)}${styleQuery(result.css.lang)}`;
          output += `\nimport ${JSON.stringify(style)};`;
        }
        return { code: output, map: result.map };
      },
    },
    {
      // The Solid JSX compiler does not remove TypeScript types.
      name: 'solid-sfc:typescript',
      enforce: 'pre',
      async transform(code, id) {
        if (!isSFC(id)) {
          return null;
        }
        const result = await transformWithOxc(code, `${splitId(id).file}.tsx`, {
          lang: 'tsx',
          jsx: 'preserve',
        });
        return { code: result.code, map: result.map };
      },
    },
    ...solidPlugin({
      ...solidOptions,
      extensions: [...(solidOptions.extensions ?? []), [EXTENSION, { typescript: true }]],
    }),
  ];
}
