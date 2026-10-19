# solid-sfc-vscode

## 1.0.0

### Major Changes

- 169392c: `solid-sfc` now requires Solid 2.0.
  Install `solid-js@2`, `@solidjs/web` and `@solidjs/vite-plugin`, and remove `vite-plugin-solid`.
  The editor and type-checking packages start at the same version as `solid-sfc`.

### Minor Changes

- e154629: Add dynamic tags. `<{tag} a=b>children</>` renders a component from `dynamic(() => tag)`, where the tag can be any expression. A dynamic tag gets the scope attribute and the style variables, matches every tag selector when looking for unused selectors, and gets no accessibility warnings. Typing `>` after a dynamic tag in the editor inserts `</>`.
- e1901aa: Add completions for control flow keywords after `#` and for `solid:` elements, and code actions that wrap selected markup in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`. The VS Code extension drops its control flow snippets, since the language server completes them in every editor.
- 7f81220: Add editor and type-checking support for `.solid` files.
  `@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
  `solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
  `@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.

### Patch Changes

- 2cff1d6: Keep type information in the editor while a file has a syntax error. `SFCError` has a `recover` range, such as an unfinished tag or the opening tag of an unclosed element, and `compileForEditor` in `@solid-sfc/language-core` blanks it out and compiles the rest of the file. Without a range, it blanks the line of the error.
- 94896af: Highlight attribute values without braces, such as `size=16`, in JSX inside scripts and markup expressions. The TSX grammar read them as invalid.
