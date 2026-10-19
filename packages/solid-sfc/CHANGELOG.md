# solid-sfc

## 1.0.0

### Major Changes

- 1bc6984: Remove the `(name)` attribute shorthand. `{name}` is the only shorthand for `name={name}`, and `(name)` is an error that suggests it.
- 169392c: `solid-sfc` now requires Solid 2.0.
  Install `solid-js@2`, `@solidjs/web` and `@solidjs/vite-plugin`, and remove `vite-plugin-solid`.
  The editor and type-checking packages start at the same version as `solid-sfc`.
- f5008ab: Remove the `solid:` elements that control flow blocks and dynamic tags replace: `<solid:for>`, `<solid:show>`, `<solid:switch>`, `<solid:match>`, `<solid:repeat>`, `<solid:errored>`, `<solid:loading>`, `<solid:reveal>`, `<solid:portal>`, `<solid:hydration>`, `<solid:no-hydration>` and `<solid:dynamic>`. Using one is a compile error that names what to use instead.

### Minor Changes

- ed27f54: Warn about common accessibility problems in the markup, such as an `<img>` without `alt`. A `<!-- solid-sfc-ignore code -->` comment before an element turns off a warning.
- aff4710: Allow imports in the scripts of blocks. The compiler moves them to the top of the module and writes an import that the file already has only once. An imported name stays local to its block: if something else in the file declares the same name, the import and its uses in the block are renamed.
- a85d975: Add plugins for Rollup, Rolldown, webpack, Rspack and esbuild: `solid-sfc/rollup`, `solid-sfc/rolldown`, `solid-sfc/webpack`, `solid-sfc/rspack` and `solid-sfc/esbuild`. The plugin is now built on unplugin. Outside Vite, it compiles the JSX with `@solidjs/compiler`, and its `compiler` option takes the options of Solid's compiler. The Vite plugin also takes `root` and `dev`. Debug names in dev mode no longer break `$signal` and `$memo` calls whose arguments read reactive variables.
- 748f7ea: Compile-time functions such as `$signal` and `$memo` now come from the `solid-labels` 1.0 compiler, which is included in `solid-sfc`.
  They target Solid 2.0, and destructuring `$props()` keeps props reactive.
  Labels such as `effect:` and comment directives are no longer supported. Remove `solid-labels` and `@babel/core` from your dependencies.
- 169392c: Add control flow blocks to the markup: `#if`, `#for`, `#repeat`, `#switch`, `#try`, `#loading`, `#reveal`, `#portal`, `#no-hydration`, `#hydration` and `#key`.
  `#for (item of list by key)` keys the items, and `by index` keeps one entry per position.
  `#template name(params) { }` declares markup that the file can render with arguments.
  A `<script>` at the start of a block runs once each time the block body is created, such as once for each item.
- e154629: Add dynamic tags. `<{tag} a=b>children</>` renders a component from `dynamic(() => tag)`, where the tag can be any expression. A dynamic tag gets the scope attribute and the style variables, matches every tag selector when looking for unused selectors, and gets no accessibility warnings. Typing `>` after a dynamic tag in the editor inserts `</>`.
- 2cff1d6: Keep type information in the editor while a file has a syntax error. `SFCError` has a `recover` range, such as an unfinished tag or the opening tag of an unclosed element, and `compileForEditor` in `@solid-sfc/language-core` blanks it out and compiles the rest of the file. Without a range, it blanks the line of the error.
- 7f81220: Add editor and type-checking support for `.solid` files.
  `@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
  `solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
  `@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.
- 78029be: When the last compound of a selector is `:global(...)`, as in `.content :global(p)`, the compound before it is scoped, so the rule only reaches into the elements of the file. Before, such a selector was not scoped at all. The compiler also runs in browsers now, where PostCSS makes no source maps.
- f708fab: `$isPending` and `$latest` wrap their argument in a function, as `$untrack` and `$resolve` do, so `$isPending(quote)` works on a reactive variable. An argument that is already a function stays as it is.
- db0285a: The compiled module is laid out like code written by hand. Imports come first, one statement for each module. The script is indented in the component function, the markup in its `return`, and blank lines are kept to one. Setters are named like `setCount`, generated names only get a number when they would clash, and `onClick=(handler)` compiles to `onClick={handler}`. Declarations at the start of a `#for` or `#template` body go in its function, and comments on lines of their own leave no blank line.
- fef2442: `$refresh(quote)` passes the accessor of a reactive variable, as Solid's `refresh` needs, instead of its value, which threw at runtime. In an `$effect`, it does not make the effect track the variable.
- e3cd220: Scoped styles no longer depend on `solid-styled`.
  `<style>` blocks now compile to a CSS file that Vite bundles, so no styles are added at runtime.
  Interpolations joined with other text, such as `${size}px`, produce valid CSS.
  Remove `solid-styled` from your dependencies, and move `solid-sfc` to `dependencies` because components import `solid-sfc/runtime`.
  The compiler warns about scoped selectors that no element in the file can match.
- acab5da: Support markup in scripts. Elements in `<script>`, `<script module>` and the scripts of blocks use the markup syntax, such as `const icon = <Icon size=16 {label} />`, and are scoped like the rest of the markup. As in a `.tsx` file, type parameters of arrow functions are written as `<T,>`. The outline and the fallback script of the editor mask the markup, so scripts with markup still list their declarations.
- db0285a: `#if` compiles to `<Show>`, and `#if` with `#else if` compiles to `<Switch>` and `<Match>`. Type-checking still sees conditional expressions, so TypeScript narrows values inside each branch. `compileStructure` takes a `typeCheck` option for that.
- 94f063f: Replace the Babel plugin with `.solid` single-file components.
  A `.solid` file has a `<script>` block, scoped `<style>` blocks and JSX markup with a shorter attribute syntax.
  Use the new Vite plugin from `solid-sfc/vite`. The `babel-plugin-solid-sfc` package is no longer published.
- 15e3aa2: `solid-sfc/vite` uses `src/App.solid` and `src/Document.solid` as the app and the document of the start mode of `@solidjs/vite-plugin`, when they exist.
- ee68f46: Support `<style lang="scss">` and `<style lang="less">`. The compiler scopes the selectors in the source, and Vite compiles the result with the preprocessor.
- 39c8cff: Styles are added to the page while their component is rendered, as in solid-styled. The first instance of a component adds a `<style>` to the head through `useStyle` from `solid-sfc/runtime`, and the last one to be removed removes it, so a page only loads the CSS of the components it shows. On the server, the stylesheet goes into the head of the document with `useHead`, which also fixes server-rendered pages in start mode having no styles until scripts ran. The bundler still processes the CSS: Vite through `?inline`, and the other bundlers through a JavaScript module that the plugin compiles, with `sass` or `less` for SCSS and Less. The builds write no `.css` files for components.
- 70c6ec4: Add `<solid:window>` and `<solid:document>`, which listen to events of `window` and `document` while the component is mounted.

### Patch Changes

- 627d9cc: Assignments whose value is in parentheses, as in `count = (next)`, no longer leave a `)` behind in the compiled setter call.
- 58d76b7: Read `<T>(…) =>` and `<T>(…): R` in scripts as type parameters, so generic arrow functions and generic function types work without the `<T,>` form.
- ee89e50: Stylesheets are minified unless `dev` is set: `compile()` minifies the stylesheet it writes into the module, and the plugin minifies the stylesheets that it compiles for bundlers other than Vite. Vite minifies its own in production builds.
- a32c45d: Imports such as `App.solid?raw` and `App.solid?url` are left to the bundler instead of being compiled as components.
- efce0ac: Support `"use server"` functions in `.solid` files with the `serverFunctions` option of `@solidjs/vite-plugin`, in SSR and client start mode. Its transform reads `.solid` modules under a `.tsx` name, which Solid's compiler accepts.
