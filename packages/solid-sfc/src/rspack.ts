import { createRspackPlugin } from 'unplugin';
import type { UnpluginInstance } from 'unplugin';
import { factory } from './plugin.ts';
import type { SolidSFCPluginOptions } from './plugin.ts';

export type { SolidCompilerOptions, SolidSFCPluginOptions } from './plugin.ts';

/** Compiles `.solid` files with Rspack, including the JSX. */
const solidSFC: UnpluginInstance<SolidSFCPluginOptions | undefined>['rspack'] =
  createRspackPlugin(factory);

export default solidSFC;
