import { createRolldownPlugin } from 'unplugin';
import type { UnpluginInstance } from 'unplugin';
import { factory } from './plugin.ts';
import type { SolidSFCPluginOptions } from './plugin.ts';

export type { SolidCompilerOptions, SolidSFCPluginOptions } from './plugin.ts';

/** Compiles `.solid` files with Rolldown, including the JSX. */
const solidSFC: UnpluginInstance<SolidSFCPluginOptions | undefined>['rolldown'] =
  createRolldownPlugin(factory);

export default solidSFC;
