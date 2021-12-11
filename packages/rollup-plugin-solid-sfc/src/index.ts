import { Plugin } from 'rollup';
import solidSFC, { TransformOptions } from 'solid-sfc';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface Options extends Omit<TransformOptions, 'filename'> {
  //
}

export default function solidSFCPlugin(options?: Options): Plugin {
  return {
    name: 'solid-sfc',
    resolveId(id, importer) {
      if (/\.solid$/.test(id) && importer) {
        return path.join(path.dirname(importer), id);
      }
      return null;
    },
    async load(id) {
      if (id.startsWith('\0')) {
        return null;
      }
      if (!/\.solid$/.test(id)) {
        return null;
      }
      return fs.readFile(id, { encoding: 'utf-8' });
    },
    async transform(code, id) {
      if (id.startsWith('\0')) {
        return null;
      }
      if (!/\.solid$/.test(id)) {
        return null;
      }
      const name = path.basename(id);
      const result = await solidSFC(code, {
        filename: name,
        target: options?.target,
        babel: options?.babel,
        dev: options?.dev,
        sourcemap: options?.sourcemap,
      });
      return result;
    },
  };
}
