import type { TransformOptions } from '@babel/core';
import solidLabels from 'solid-labels/babel';
import { compile as compileStyles } from 'solid-styled/compiler';
import type { SolidStyledOptions } from 'solid-styled/compiler';
import { transformWithOxc } from 'vite';
import type { Plugin } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import type { Options as SolidPluginOptions } from 'vite-plugin-solid';
import { compile } from './compile.ts';

export interface SolidSFCOptions {
  /** Options for `vite-plugin-solid`. */
  solid?: Partial<SolidPluginOptions>;
  /** Options for `solid-styled`. */
  styled?: SolidStyledOptions;
}

const EXTENSION = '.solid';

function isSFC(id: string): boolean {
  return id.split('?', 1)[0]!.endsWith(EXTENSION);
}

async function getUserBabelOptions(
  options: Partial<SolidPluginOptions>,
  source: string,
  id: string,
  ssr: boolean,
): Promise<TransformOptions> {
  const { babel } = options;
  if (typeof babel === 'function') {
    return babel(source, id, ssr);
  }
  return babel ?? {};
}

/**
 * Compiles `.solid` files. It includes `vite-plugin-solid`, so do not add it
 * again.
 */
export default function solidSFC(options: SolidSFCOptions = {}): Plugin[] {
  const solidOptions = options.solid ?? {};
  let mode: 'development' | 'production' = 'production';

  return [
    {
      name: 'solid-sfc',
      enforce: 'pre',
      configResolved(config) {
        mode = config.isProduction ? 'production' : 'development';
      },
      transform(code, id) {
        if (!isSFC(id)) {
          return null;
        }
        const result = compile(code, { filename: id.split('?', 1)[0] });
        return { code: result.code, map: result.map };
      },
    },
    {
      name: 'solid-sfc:styled',
      enforce: 'pre',
      async transform(code, id) {
        if (!isSFC(id) || !code.includes("from 'solid-styled'")) {
          return null;
        }
        // solid-styled picks its parser from the file extension.
        const result = await compileStyles(`${id}.tsx`, code, { env: mode, ...options.styled });
        return { code: result.code, map: result.map };
      },
    },
    {
      // vite-plugin-solid parses TypeScript but does not remove types.
      name: 'solid-sfc:typescript',
      enforce: 'pre',
      async transform(code, id) {
        if (!isSFC(id)) {
          return null;
        }
        const result = await transformWithOxc(code, `${id.split('?', 1)[0]}.tsx`, {
          lang: 'tsx',
          jsx: 'preserve',
        });
        return { code: result.code, map: result.map };
      },
    },
    solidPlugin({
      ...solidOptions,
      extensions: [...(solidOptions.extensions ?? []), [EXTENSION, { typescript: true }]],
      async babel(source, id, ssr) {
        const babelOptions = await getUserBabelOptions(solidOptions, source, id, ssr);
        if (!isSFC(id)) {
          return babelOptions;
        }
        return {
          ...babelOptions,
          plugins: [solidLabels, ...(babelOptions.plugins ?? [])],
        };
      },
    }),
  ];
}
