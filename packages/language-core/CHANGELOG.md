# @solid-sfc/language-core

## 1.0.0

### Major Changes

- 169392c: `solid-sfc` now requires Solid 2.0.
  Install `solid-js@2`, `@solidjs/web` and `@solidjs/vite-plugin`, and remove `vite-plugin-solid`.
  The editor and type-checking packages start at the same version as `solid-sfc`.

### Minor Changes

- e154629: Add dynamic tags. `<{tag} a=b>children</>` renders a component from `dynamic(() => tag)`, where the tag can be any expression. A dynamic tag gets the scope attribute and the style variables, matches every tag selector when looking for unused selectors, and gets no accessibility warnings. Typing `>` after a dynamic tag in the editor inserts `</>`.
- e1901aa: Add completions for control flow keywords after `#` and for `solid:` elements, and code actions that wrap selected markup in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`. The VS Code extension drops its control flow snippets, since the language server completes them in every editor.
- 2cff1d6: Keep type information in the editor while a file has a syntax error. `SFCError` has a `recover` range, such as an unfinished tag or the opening tag of an unclosed element, and `compileForEditor` in `@solid-sfc/language-core` blanks it out and compiles the rest of the file. Without a range, it blanks the line of the error.
- 7f81220: Add editor and type-checking support for `.solid` files.
  `@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
  `solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
  `@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.
- acab5da: Support markup in scripts. Elements in `<script>`, `<script module>` and the scripts of blocks use the markup syntax, such as `const icon = <Icon size=16 {label} />`, and are scoped like the rest of the markup. As in a `.tsx` file, type parameters of arrow functions are written as `<T,>`. The outline and the fallback script of the editor mask the markup, so scripts with markup still list their declarations.
- ee68f46: Support `<style lang="scss">` and `<style lang="less">`. The compiler scopes the selectors in the source, and Vite compiles the result with the preprocessor.

### Patch Changes

- db0285a: `#if` compiles to `<Show>`, and `#if` with `#else if` compiles to `<Switch>` and `<Match>`. Type-checking still sees conditional expressions, so TypeScript narrows values inside each branch. `compileStructure` takes a `typeCheck` option for that.
- Updated dependencies [ed27f54]
- Updated dependencies [627d9cc]
- Updated dependencies [1bc6984]
- Updated dependencies [aff4710]
- Updated dependencies [a85d975]
- Updated dependencies [748f7ea]
- Updated dependencies [169392c]
- Updated dependencies [e154629]
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
