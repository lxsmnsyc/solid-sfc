import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Plugin } from 'vite';
import solidPlugin from '@solidjs/vite-plugin';
import type { Options as SolidPluginOptions } from '@solidjs/vite-plugin';
import { createVitePlugin } from 'unplugin';
import { EXTENSION, factory } from './plugin.ts';
import type { SolidSFCPluginOptions } from './plugin.ts';

export interface SolidSFCOptions extends Omit<SolidSFCPluginOptions, 'compiler'> {
  /** Options for `@solidjs/vite-plugin`. */
  solid?: Partial<SolidPluginOptions>;
}

/**
 * Start mode looks for `src/App.tsx` and `src/Document.tsx`. When those are
 * not given, this points it at `src/App.solid` and `src/Document.solid`.
 */
function withSolidEntries(options: Partial<SolidPluginOptions>): Partial<SolidPluginOptions> {
  if (!options.start) {
    return options;
  }
  const start = options.start === true ? {} : { ...options.start };
  for (const [key, file] of [
    ['app', 'src/App.solid'],
    ['document', 'src/Document.solid'],
  ] as const) {
    if (!start[key] && existsSync(file)) {
      start[key] = `./${file}`;
    }
  }
  return { ...options, start };
}

/** The name that `.solid` modules have for the server function transform. */
const SERVER_FUNCTION_SUFFIX = '.tsx';
// Where `@solidjs/vite-plugin` writes the server function modules of a client build.
const PERSISTED_MANIFEST = '.vite/solid-server-functions.json';

/**
 * The server function transform of `@solidjs/vite-plugin` passes the module
 * id to Solid's compiler, which only reads JavaScript and TypeScript names.
 * It sees a `.solid` module as `App.solid.tsx`, which also matches its
 * default filter. Its manifest then imports that name, which the plugin
 * resolves back to the `.solid` file. The manifest that a client build
 * writes for the server build only keeps files that exist, so it gets the
 * `.solid` names.
 */
function withServerFunctionNames(plugins: Plugin[]): Plugin[] {
  for (const plugin of plugins) {
    if (
      plugin.name === 'solid:server-functions/setup' &&
      typeof plugin.writeBundle === 'function'
    ) {
      const writeBundle = plugin.writeBundle;
      plugin.writeBundle = async function (options, bundle) {
        await writeBundle.call(this, options, bundle);
        const file = path.join(options.dir ?? '', PERSISTED_MANIFEST);
        if (options.dir && existsSync(file)) {
          const entries = JSON.parse(await readFile(file, 'utf8')) as string[];
          const names = entries.map((entry) =>
            entry.endsWith(`${EXTENSION}${SERVER_FUNCTION_SUFFIX}`)
              ? entry.slice(0, -SERVER_FUNCTION_SUFFIX.length)
              : entry,
          );
          await writeFile(file, JSON.stringify(names, null, 2));
        }
      };
    }
    if (
      plugin.name !== 'solid:server-functions/compiler' ||
      typeof plugin.transform !== 'function'
    ) {
      continue;
    }
    const transform = plugin.transform;
    plugin.transform = function (code, id, options) {
      const index = id.indexOf('?');
      const file = index === -1 ? id : id.slice(0, index);
      const query = index === -1 ? '' : id.slice(index);
      const name = file.endsWith(EXTENSION) ? `${file}${SERVER_FUNCTION_SUFFIX}${query}` : id;
      return transform.call(this, code, name, options);
    };
  }
  return plugins;
}

const sfcPlugin = createVitePlugin(factory);

/**
 * Compiles `.solid` files. It includes `@solidjs/vite-plugin`, which compiles
 * the JSX and adds HMR and start mode, so do not add it again.
 */
export default function solidSFC(options: SolidSFCOptions = {}): Plugin[] {
  const { solid = {}, ...rest } = options;
  const solidOptions = withSolidEntries(solid);
  return [
    sfcPlugin({ ...rest, jsx: false }) as Plugin,
    ...withServerFunctionNames(
      solidPlugin({
        ...solidOptions,
        extensions: [...(solidOptions.extensions ?? []), [EXTENSION, { typescript: true }]],
      }),
    ),
  ];
}
