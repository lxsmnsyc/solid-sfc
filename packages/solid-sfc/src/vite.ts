import { existsSync } from 'node:fs';
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
    ...solidPlugin({
      ...solidOptions,
      extensions: [...(solidOptions.extensions ?? []), [EXTENSION, { typescript: true }]],
    }),
  ];
}
