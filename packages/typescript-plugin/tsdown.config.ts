import { defineConfig } from 'tsdown';

// The TypeScript server loads plugins with `require`.
export default defineConfig({
  entry: ['src/index.ts'],
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  dts: true,
  sourcemap: true,
});
