import { Plugin } from 'esbuild';
import { TransformOptions } from 'solid-sfc';

export interface Options extends Omit<TransformOptions, 'filename'> {
  //
}

export default function solidSFCPlugin(options?: Options): Plugin {
  return {
    name: 'solid-sfc',
    async setup(build) {
      const solidSFC = (await import('solid-sfc')).default;
      const path = await import('path');
      const fs = await import('fs/promises');

      build.onResolve({ filter: /.solid$/ }, (args) => ({
        namespace: 'solid-sfc',
        path: path.join(args.resolveDir, args.path.substring(0, args.path.length - 4)),
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
