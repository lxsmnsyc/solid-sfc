// VS Code loads TypeScript server plugins by package name from the
// `node_modules` folder of the extension. This package points at the bundle.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const PLUGIN_PACK = 'solid-sfc-typescript-plugin-pack';

/** Writes the plugin package into the `node_modules` folder in `root`. */
export function writePluginPack(root) {
  const pack = path.join(root, 'node_modules', PLUGIN_PACK);
  mkdirSync(pack, { recursive: true });
  writeFileSync(
    path.join(pack, 'package.json'),
    `${JSON.stringify({ name: PLUGIN_PACK, private: true, main: 'index.js' }, null, 2)}\n`,
  );
  writeFileSync(
    path.join(pack, 'index.js'),
    "module.exports = require('../../dist/typescript-plugin.cjs');\n",
  );
}
