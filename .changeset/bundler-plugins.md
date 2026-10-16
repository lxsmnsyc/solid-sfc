---
'solid-sfc': minor
---

Add plugins for Rollup, Rolldown, webpack, Rspack and esbuild: `solid-sfc/rollup`, `solid-sfc/rolldown`, `solid-sfc/webpack`, `solid-sfc/rspack` and `solid-sfc/esbuild`. The plugin is now built on unplugin. Outside Vite, it compiles the JSX with `@solidjs/compiler`, and its `compiler` option takes the options of Solid's compiler. The Vite plugin also takes `root` and `dev`. Debug names in dev mode no longer break `$signal` and `$memo` calls whose arguments read reactive variables.
