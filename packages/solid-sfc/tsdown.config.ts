import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/vite.ts',
    'src/rollup.ts',
    'src/rolldown.ts',
    'src/webpack.ts',
    'src/rspack.ts',
    'src/esbuild.ts',
    'src/runtime.ts',
  ],
  format: 'esm',
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
  fixedExtension: false,
});
