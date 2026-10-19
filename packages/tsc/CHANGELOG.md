# @solid-sfc/tsc

## 1.0.0

### Major Changes

- 169392c: `solid-sfc` now requires Solid 2.0.
  Install `solid-js@2`, `@solidjs/web` and `@solidjs/vite-plugin`, and remove `vite-plugin-solid`.
  The editor and type-checking packages start at the same version as `solid-sfc`.

### Minor Changes

- 7f81220: Add editor and type-checking support for `.solid` files.
  `@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
  `solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
  `@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.

### Patch Changes

- Updated dependencies [e154629]
- Updated dependencies [e1901aa]
- Updated dependencies [2cff1d6]
- Updated dependencies [7f81220]
- Updated dependencies [acab5da]
- Updated dependencies [db0285a]
- Updated dependencies [169392c]
- Updated dependencies [ee68f46]
  - @solid-sfc/language-core@1.0.0
