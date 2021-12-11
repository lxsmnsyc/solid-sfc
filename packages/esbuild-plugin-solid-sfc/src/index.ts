import { Plugin } from 'esbuild';
import { TransformOptions } from 'solid-sfc';
import solidSFC from 'solid-sfc';
import path from 'path';
import fs from 'fs/promises';

export interface Options extends Omit<TransformOptions, 'filename'> {
  //
}

export default function solidSFCPlugin(options?: Options): Plugin {
  return {
    name: 'solid-sfc',
    setup(build) {
      build.onResolve({ filter: /.solid$/ }, (args) => ({
        namespace: 'solid-sfc',
        path: path.join(args.resolveDir, args.path),
      }));

      build.onLoad({ filter: /.*/, namespace: 'solid-sfc' }, async (args) => {
        const name = path.basename(args.path);
        const result = await solidSFC(await fs.readFile(args.path, { encoding: 'utf-8' }), {
          filename: name,
          target: options?.target,
          babel: options?.babel,
          dev: options?.dev,
          sourcemap: options?.sourcemap,
        });
        return {
          contents: result.map
            ? `${result.code}\n//# sourceMappingURL=data:application/json;charset=utf8;base64,${JSON.stringify(result.map)}`
            : result.code,
          loader: options?.target === 'preserve' ? 'jsx' : 'js',
        };
      });
    },
  };
}
