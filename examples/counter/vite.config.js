import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import solidLabels from 'babel-plugin-solid-labels';
import solidSFC from 'babel-plugin-solid-sfc';

export default defineConfig({
  plugins: [
    solidPlugin({
      babel: {
        plugins: [
          solidLabels,
          solidSFC,
        ],
      },
    }),
  ],
});
