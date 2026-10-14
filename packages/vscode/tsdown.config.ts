import { defineConfig } from 'tsdown';

// VS Code loads CommonJS extensions. Both entries bundle their dependencies,
// so the extension does not ship node_modules.
export default defineConfig([
  {
    entry: { extension: 'src/extension.ts' },
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    deps: { neverBundle: ['vscode'], alwaysBundle: [/.*/] },
    dts: false,
    sourcemap: true,
  },
  {
    entry: { server: 'src/server.ts' },
    format: 'cjs',
    platform: 'node',
    target: 'node22',
    deps: { alwaysBundle: [/.*/] },
    // Native parser bindings cannot be bundled, and one extension serves
    // every platform, so the server uses the WebAssembly build of oxc-parser.
    alias: { 'oxc-parser': 'oxc-parser/src-js/wasm.js' },
    // The `main` builds of the vscode-*-languageservice packages are UMD
    // modules with dynamic requires. Their ESM builds bundle cleanly.
    inputOptions: { resolve: { mainFields: ['module', 'main'] } },
    dts: false,
    sourcemap: true,
    copy: [
      // TypeScript reads its lib files from the directory of its own module.
      {
        from: 'node_modules/@solid-sfc/language-server/node_modules/typescript-api/lib/lib.*.d.ts',
        to: 'dist',
      },
      // The WebAssembly parser reads its binary from the same directory.
      {
        from: 'node_modules/@oxc-parser/binding-wasm32-wasip1/parser.wasm32-wasip1.wasm',
        to: 'dist',
      },
    ],
  },
]);
