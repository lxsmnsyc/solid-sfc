import { createSolidLanguagePlugin } from '@solid-sfc/language-core';
import { createLanguageServicePlugin } from '@volar/typescript/lib/quickstart/createLanguageServicePlugin.js';

/**
 * A TypeScript server plugin. `.ts` and `.tsx` files that import `.solid`
 * files get the props type of each component, in editors that use the
 * TypeScript server.
 */
const plugin: ReturnType<typeof createLanguageServicePlugin> = createLanguageServicePlugin(() => ({
  languagePlugins: [createSolidLanguagePlugin<string>()],
}));

export default plugin;
