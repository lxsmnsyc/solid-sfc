import { copyFile } from 'node:fs/promises';
import path from 'node:path';
import solidSFC from 'solid-sfc/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import markdown from './plugins/markdown.ts';

// The compiler runs in the browser on WebAssembly with threads, which need
// cross-origin isolation.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

/**
 * Static hosts serve `404.html` for paths without a file, so a copy of the
 * app opens deep links such as `/docs/markup`.
 */
function notFoundPage(): Plugin {
  let outDir = 'dist';
  return {
    name: 'website:404',
    apply: 'build',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      await copyFile(path.join(outDir, 'index.html'), path.join(outDir, '404.html'));
    },
  };
}

export default defineConfig({
  // `BASE` is the path the site is served from, such as `/solid-sfc/`.
  base: process.env.BASE ?? '/',
  plugins: [markdown(), solidSFC(), notFoundPage()],
  server: { headers: isolation },
  preview: { headers: isolation },
  // The WebAssembly packages load their files relative to their own modules.
  optimizeDeps: { exclude: ['oxc-parser', '@oxc-parser/binding-wasm32-wasi'] },
  worker: { format: 'es' },
  // The playground chunk holds the compiler and PostCSS.
  build: { target: 'es2023', chunkSizeWarningLimit: 700 },
});
