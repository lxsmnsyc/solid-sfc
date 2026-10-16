/**
 * The bundler plugin, built on unplugin. It compiles `.solid` files to
 * TypeScript JSX, removes the types, and, outside Vite, compiles the JSX with
 * Solid's compiler. In Vite, `@solidjs/vite-plugin` compiles the JSX.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import remapping from '@jridgewell/remapping';
import { transform as transformJSX } from '@solidjs/compiler';
import type { TransformOptions as SolidCompilerOptions } from '@solidjs/compiler';
import { transformSync as transformTypeScript } from 'oxc-transform';
import type { UnpluginFactory } from 'unplugin';
import { compile } from './compile.ts';
import type { CompileResult, SourceMap } from './compile.ts';
import { hash } from './style.ts';

export type { SolidCompilerOptions };

export interface SolidSFCPluginOptions {
  /**
   * The project root. Scoped style hashes use paths from it, so they are the
   * same on every machine. Defaults to the working directory.
   */
  root?: string;
  /** Adds debug names to signals and memos. Defaults to `NODE_ENV !== 'production'`. */
  dev?: boolean;
  /**
   * Options for Solid's JSX compiler, such as `generate: 'ssr'` and
   * `hydratable`. Not used in Vite, where `@solidjs/vite-plugin` compiles
   * the JSX.
   */
  compiler?: SolidCompilerOptions;
}

/** Internal options of the factory. */
export interface FactoryOptions extends SolidSFCPluginOptions {
  /** False when another plugin compiles the JSX, as `@solidjs/vite-plugin` does. */
  jsx?: boolean;
}

export const EXTENSION = '.solid';
/**
 * The stylesheet of a component is a module whose default export is the CSS.
 * In Vite, `inline` makes Vite's CSS pipeline compile it and export the
 * result, and the extension at the end, such as `.scss`, picks the language.
 * Other bundlers get a JavaScript module that the plugin compiles.
 */
const STYLE_QUERY = /\?solid-sfc&type=style(?:&inline)?&lang\.(css|scss|less)(\.js)?$/;

function styleQuery(lang: string, vite: boolean): string {
  return vite
    ? `?solid-sfc&type=style&inline&lang.${lang}`
    : `?solid-sfc&type=style&lang.${lang}.js`;
}

/** Imports a package that the project may not install. */
async function importOptional(name: string, file: string, lang: string): Promise<any> {
  try {
    const module = await import(name);
    return module.default ?? module;
  } catch {
    throw new Error(`Install "${name}" to compile <style lang="${lang}"> (${file})`);
  }
}

/** Compiles Sass and Less with the packages that the project installs. */
async function preprocess(code: string, lang: string, file: string): Promise<string> {
  if (lang === 'scss') {
    const sass = await importOptional('sass', file, lang);
    return sass.compileString(code, { url: pathToFileURL(file), syntax: 'scss' }).css;
  }
  if (lang === 'less') {
    const less = await importOptional('less', file, lang);
    const result = await less.render(code, { filename: file });
    return result.css;
  }
  return code;
}

function splitId(id: string): { file: string; query: string } {
  const index = id.indexOf('?');
  return index === -1
    ? { file: id, query: '' }
    : { file: id.slice(0, index), query: id.slice(index) };
}

// Queries that ask for the file as something else, such as its text.
const OTHER_QUERY = /[?&](?:solid-sfc|raw|url|inline)\b/;

/**
 * True for a `.solid` module. False for its stylesheet, and for imports such
 * as `App.solid?raw` that ask for the file as something else.
 */
export function isSFC(id: string): boolean {
  const { file, query } = splitId(id);
  return file.endsWith(EXTENSION) && !OTHER_QUERY.test(query);
}

/** Removes TypeScript types and keeps the JSX. */
export function stripTypes(code: string, file: string): { code: string; map: SourceMap } {
  const result = transformTypeScript(`${file}.tsx`, code, {
    jsx: 'preserve',
    sourcemap: true,
  });
  const error = result.errors[0];
  if (error) {
    throw new Error(`${error.message} (${file})`);
  }
  return { code: result.code, map: result.map as SourceMap };
}

export const factory: UnpluginFactory<FactoryOptions | undefined> = (options = {}, meta) => {
  let root = options.root ?? process.cwd();
  let dev = options.dev ?? process.env.NODE_ENV !== 'production';
  const jsx = options.jsx ?? true;

  const vite = meta.framework === 'vite';
  // The path from the root is the same on every machine.
  const scopeOf = (file: string): string =>
    hash(path.relative(root, file).split(path.sep).join('/'));
  const compileFile = (code: string, file: string): CompileResult =>
    compile(code, {
      filename: file,
      dev,
      scope: scopeOf(file),
      stylesheet: (lang) => `./${path.basename(file)}${styleQuery(lang, vite)}`,
    });

  return {
    name: 'solid-sfc',
    enforce: 'pre',
    vite: {
      configResolved(config) {
        root = options.root ?? config.root;
        dev = options.dev ?? !config.isProduction;
      },
    },
    resolveId(source, importer) {
      if (importer && STYLE_QUERY.test(source)) {
        return path.resolve(path.dirname(splitId(importer).file), source);
      }
      // The manifest of Vite's server functions names `.solid` modules as
      // `App.solid.tsx`. See `withServerFunctionNames` in vite.ts.
      if (source.endsWith(`${EXTENSION}.tsx`) && path.isAbsolute(source)) {
        const file = source.slice(0, -'.tsx'.length);
        return existsSync(file) ? file : null;
      }
      return null;
    },
    loadInclude(id) {
      return STYLE_QUERY.test(id);
    },
    async load(id) {
      const { file } = splitId(id);
      // Compile again instead of caching, so the CSS always matches the file.
      const { css } = compile(await readFile(file, 'utf8'), {
        filename: file,
        scope: scopeOf(file),
      });
      if (vite) {
        // Vite's CSS pipeline compiles the stylesheet.
        return css ? { code: css.code, map: css.map } : '';
      }
      const sheet = css ? await preprocess(css.code, css.lang, file) : '';
      return `export default ${JSON.stringify(sheet)};`;
    },
    transformInclude(id) {
      return isSFC(id);
    },
    transform(code, id) {
      const { file } = splitId(id);
      const result = compileFile(code, file);
      for (const warning of result.warnings) {
        const location = `${path.relative(root, file)}:${warning.line}:${warning.column}`;
        this.warn(`${warning.code}: ${warning.message} (${location})`);
      }
      // Solid's JSX compilers keep TypeScript types, so they go first.
      const plain = stripTypes(result.code, file);
      let output = plain.code;
      // The maps go from the last step to the first.
      const maps: unknown[] = [plain.map, result.map];
      if (jsx) {
        const compiled = transformJSX(output, {
          filename: `${file}.jsx`,
          dev,
          sourceMap: true,
          ...options.compiler,
        });
        output = compiled.code;
        if (compiled.map) {
          maps.unshift(JSON.parse(compiled.map));
        }
      }
      const map = remapping(maps as never, () => null) as unknown as SourceMap;
      return { code: output, map };
    },
  };
};
