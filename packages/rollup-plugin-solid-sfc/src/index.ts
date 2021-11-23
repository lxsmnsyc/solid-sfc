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
      const file = await fs.readFile(id, { encoding: 'utf-8' });
      const name = path.basename(id);
      const result = await solidSFC(file, {
        filename: name,
        target: options?.target,
        babel: options?.babel,
      });
      return result;
    },
  };
}
