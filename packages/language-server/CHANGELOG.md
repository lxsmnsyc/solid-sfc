# @solid-sfc/language-server

## 1.0.2

### Patch Changes

- Updated dependencies [196f2ac]
- Updated dependencies [a633a3d]
- Updated dependencies [a633a3d]
- Updated dependencies [e7dda0c]
  - solid-sfc@1.1.0
  - @solid-sfc/language-core@1.0.2

## 1.0.1

### Patch Changes

- 7f29377: Update dependencies to their latest minor and patch versions: Volar 2.4.31, oxc-parser and oxc-transform 0.157, magic-string, postcss, postcss-selector-parser and unplugin.
- Updated dependencies [7f29377]
- Updated dependencies [472cccf]
- Updated dependencies [978fca2]
- Updated dependencies [eb52919]
- Updated dependencies [e19d194]
- Updated dependencies [7a24e29]
- Updated dependencies [ddb7310]
- Updated dependencies [2f78648]
- Updated dependencies [03de971]
  - solid-sfc@1.0.1
  - @solid-sfc/language-core@1.0.1

## 1.0.0

### Major Changes

- 169392c: `solid-sfc` now requires Solid 2.0.
  Install `solid-js@2`, `@solidjs/web` and `@solidjs/vite-plugin`, and remove `vite-plugin-solid`.
  The editor and type-checking packages start at the same version as `solid-sfc`.

### Minor Changes

- e1901aa: Add completions for control flow keywords after `#` and for `solid:` elements, and code actions that wrap selected markup in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`. The VS Code extension drops its control flow snippets, since the language server completes them in every editor.
- 7f81220: Add editor and type-checking support for `.solid` files.
  `@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
  `solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
  `@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.

### Patch Changes

- 15d3d71: Files with `<style lang="scss">` or `<style lang="less">` no longer get a `css-preprocessor` warning in the editor. The bundler plugin compiles those stylesheets.
- Updated dependencies [ed27f54]
- Updated dependencies [627d9cc]
- Updated dependencies [1bc6984]
- Updated dependencies [aff4710]
- Updated dependencies [a85d975]
- Updated dependencies [748f7ea]
- Updated dependencies [169392c]
- Updated dependencies [e154629]
- Updated dependencies [e1901aa]
- Updated dependencies [2cff1d6]
- Updated dependencies [7f81220]
- Updated dependencies [58d76b7]
- Updated dependencies [78029be]
- Updated dependencies [ee89e50]
- Updated dependencies [f708fab]
- Updated dependencies [a32c45d]
- Updated dependencies [db0285a]
- Updated dependencies [fef2442]
- Updated dependencies [e3cd220]
- Updated dependencies [acab5da]
- Updated dependencies [efce0ac]
- Updated dependencies [db0285a]
- Updated dependencies [94f063f]
- Updated dependencies [169392c]
- Updated dependencies [f5008ab]
- Updated dependencies [15e3aa2]
- Updated dependencies [ee68f46]
- Updated dependencies [39c8cff]
- Updated dependencies [70c6ec4]
  - solid-sfc@1.0.0
  - @solid-sfc/language-core@1.0.0
