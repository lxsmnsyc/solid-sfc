import { defineConfig } from 'vite';
import solidSFC from 'solid-sfc/vite';

export default defineConfig({
  plugins: [
    // Start mode serves and builds the app from `src/App.solid` and
    // `src/Document.solid`. `ssr: true` streams server rendering, and
    // `serverFunctions` compiles "use server" functions.
    solidSFC({ solid: { start: true, ssr: true, serverFunctions: true } }),
  ],
});
