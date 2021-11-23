import { defineConfig } from 'vite';
import solidSFCPlugin from 'rollup-plugin-solid-sfc';

export default defineConfig({
  plugins: [
    {
      enforce: 'pre',
      ...solidSFCPlugin({
        dev: true,
        hmr: 'esm',
      })
    }
  ],
});
