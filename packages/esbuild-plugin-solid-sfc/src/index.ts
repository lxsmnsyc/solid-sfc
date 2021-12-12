import { Plugin } from 'esbuild';
import { TransformOptions } from 'solid-sfc';
import solidSFC from 'solid-sfc';
import path from 'path';
import fs from 'fs/promises';

export interface Options extends Omit<TransformOptions, 'filename' | 'sourcemap'> {
  //
}

export default function solidSFCPlugin(options?: Options): Plugin {
  return {
    name: 'solid-sfc',
    setup(build) {
      build.onResolve({ filter: /.solid$/ }, (args) => ({
        namespace: 'solid-sfc',
        path: args.path,
      }));

      build.onLoad({ filter: /.*/, namespace: 'solid-sfc' }, async (args) => {
        const result = await solidSFC(await fs.readFile(args.path, { encoding: 'utf-8' }), {
          filename: args.path,
          target: options?.target,
          babel: options?.babel,
          dev: options?.dev,
          sourcemap: options?.dev ? 'inline' : false,
        });
        return {
          resolveDir: path.dirname(args.path),
          contents: result.code,
          loader: options?.target === 'preserve' ? 'jsx' : 'js',
        };
      });
    },
  };
}
