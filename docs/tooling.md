# Tooling

## Vite plugin

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import solidSFC from 'solid-sfc/vite';

export default defineConfig({
  plugins: [solidSFC()],
});
```

The plugin compiles `.solid` files in these steps:

1. Compile the file into TSX and CSS.
2. Remove TypeScript types with Oxc.
3. Compile the JSX with `@solidjs/vite-plugin`, which the plugin includes. It also adds HMR and start mode.

The CSS of each component is a separate module, `App.solid?solid-sfc&type=style&lang.css`, which Vite processes like any CSS file, including SCSS and Less.

### Server-side rendering

Solid 2.0 renders on the server through the start mode of `@solidjs/vite-plugin`. Pass its options through `solid`:

```ts
export default defineConfig({
  plugins: [solidSFC({ solid: { start: true, ssr: true } })],
});
```

Start mode renders `src/App.*` inside `src/Document.*`. When `start` is set, `solid-sfc/vite` uses `src/App.solid` and `src/Document.solid` if they exist and `start.app` and `start.document` are not set. The document renders the whole page, including `<solid:hydration-script />`:

```html
<script>
  import type { Element } from 'solid-js';

  const props = $props<{ children: Element }>();
</script>

<html lang="en">
  <head>
    <meta charset="utf-8">
    <solid:hydration-script />
  </head>
  <body>{props.children}</body>
</html>
```

- Scoped styles and their CSS variables are rendered on the server, so the page has its styles before it hydrates.
- `#loading` blocks stream their content when it is ready.
- `<solid:window>` and `<solid:document>` do nothing on the server.
- Without `ssr: true`, start mode renders on the client into a prerendered document.

The [`ssr` example](../examples/ssr) is a complete app.

### Options

| Option  | Description                                                                                   |
| ------- | --------------------------------------------------------------------------------------------- |
| `solid` | Options for `@solidjs/vite-plugin`. `.solid` is added to its `extensions`.                    |
| `root`  | The project root, for stable scoped style hashes. Defaults to Vite's root.                    |
| `dev`   | Adds debug names to signals and memos. Defaults to true outside production builds.            |

## Other bundlers

The plugin is built on [unplugin](https://unplugin.unjs.io), so it also works with Rollup, Rolldown, webpack, Rspack and esbuild. Outside Vite, it compiles the JSX itself with Solid's compiler, `@solidjs/compiler`, so no Solid plugin is needed. HMR and start mode are only available in Vite.

```ts
// rollup.config.js
import solidSFC from 'solid-sfc/rollup';

export default {
  input: 'src/main.js',
  plugins: [solidSFC()],
};
```

The other bundlers import from `solid-sfc/rolldown`, `solid-sfc/webpack`, `solid-sfc/rspack` and `solid-sfc/esbuild`, and take the same options:

| Option     | Description                                                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `compiler` | Options for Solid's compiler, such as `generate: 'ssr'` and `hydratable: true` for server rendering. Defaults to DOM output. |
| `root`     | The project root, for stable scoped style hashes. Defaults to the working directory.                                          |
| `dev`      | Adds debug names to signals and memos. Defaults to `process.env.NODE_ENV !== 'production'`.                                    |

### Stylesheets

The stylesheet of each component is a module whose name ends with `.css`, `.scss` or `.less`, so the bundler handles it with its usual rules:

- esbuild bundles it into the CSS output.
- webpack and Rspack need a rule for `.css` files, such as `{ test: /\.css$/, type: 'css' }` with `experiments.css`, or `css-loader`. SCSS and Less need their loaders too.
- Rollup and Rolldown need a CSS plugin. Rolldown reads `.css` modules as CSS, which it does not bundle, so the plugin must set `moduleType: 'js'` on what it returns.

## Type checking

TypeScript cannot read `.solid` files by itself. `@solid-sfc/tsc` adds them:

```bash
pnpm add -D @solid-sfc/tsc
```

```json
{
  "scripts": {
    "typecheck": "solid-tsc --noEmit"
  }
}
```

`solid-tsc` takes the same options as `tsc` and reads the same `tsconfig.json`.

- Errors in `.solid` files point at the line and column in the file.
- Imports of `.solid` files get the props type of the component, so a missing or wrong prop is an error.
- Syntax errors in a `.solid` file are reported as `error SFC` and fail the run:

```text
src/App.solid(5,9): error TS2322: Type 'number' is not assignable to type 'string'.
src/App.solid(42,7): error SFC: Expected an expression after #if
```

TypeScript 7 has no JavaScript API, which the tools need, so `solid-tsc` uses its own copy of TypeScript 6. The rest of the project can use TypeScript 7.

## Editors

### VS Code

Install the Solid SFC extension from the Visual Studio Marketplace or Open VSX. It adds:

- Syntax highlighting for scripts, styles, markup and control flow blocks.
- Type errors, hover, completion, go-to-definition and rename in scripts and markup.
- CSS completion and errors in `<style>` blocks.
- Markup syntax errors. The rest of the file keeps its types while you type: the editor leaves out the broken part, such as an unfinished tag or an unclosed element, and checks the rest.
- Folding for `<script>` and `<style>` blocks, control flow blocks, elements and comments.
- An outline with the `<script>` blocks and their declarations, the `<style>` blocks and their rules, and `#template` declarations.
- Closing tags inserted after the `>` of an opening tag. The `solid.autoClosingTags` setting turns this off.
- Emmet abbreviations in markup, as in HTML.
- Completions for control flow blocks after `#`, such as `#if`, `#for` and `#try`, and for `solid:` elements after `<solid:`.
- Code actions on selected markup: wrap it in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`. In a block, the template goes at the start of the block, so it can use the variables of the block.
- Go-to-definition and rename for `#template` names.
- Snippets for `script`, `style` and a whole `component`.

The extension includes its own language server and TypeScript, so it needs no setup.

The extension also adds a TypeScript server plugin, so `.ts` and `.tsx` files that import `.solid` files get the props of each component. A missing or wrong prop is an error there too. The plugin needs the JavaScript TypeScript server of TypeScript 5 or 6, which VS Code uses by default. The native TypeScript 7 server does not load plugins.

### Language server

Other editors can run `@solid-sfc/language-server` over stdio:

```bash
pnpm add -g @solid-sfc/language-server
solid-sfc-language-server --stdio
```

For example, in Neovim 0.11:

```lua
vim.filetype.add({ extension = { solid = 'solid' } })

vim.lsp.config('solid_sfc', {
  cmd = { 'solid-sfc-language-server', '--stdio' },
  filetypes = { 'solid' },
  root_markers = { 'package.json', '.git' },
})
vim.lsp.enable('solid_sfc')
```

### TypeScript server plugin

Other editors that use the TypeScript server can load `@solid-sfc/typescript-plugin` from `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@solid-sfc/typescript-plugin" }]
  }
}
```

### Other tools

`@solid-sfc/language-core` is the [Volar](https://volarjs.dev) language plugin that the tools above share. Tools built on Volar can use it to support `.solid` files.

```ts
import { createSolidLanguagePlugin } from '@solid-sfc/language-core';

const plugin = createSolidLanguagePlugin({
  onError(fileName, error) {
    console.error(`${fileName}: ${error.message}`);
  },
});
```

The plugin creates these virtual files for each `.solid` file:

- `tsx`: the TSX from `compileStructure`, mapped back to the file. When the markup has a syntax error, only the scripts are kept, so the scripts still get type information.
- `style_0`, `style_1` and so on: each `<style>` block as CSS. Interpolations are replaced with placeholders of the same length.

## Compiler API

### `compile`

```ts
import { compile } from 'solid-sfc';

const { code, map, css } = compile(source, {
  filename: 'src/Counter.solid',
  scope: 'counter',
  dev: true,
});
```

| Option     | Description                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------- |
| `filename` | Used for error messages, the source maps and the component name.                                                          |
| `scope`    | The hash in the `s-<hash>` attribute. It must be unique and the same on every build. The default is a hash of `filename`. |
| `dev`      | Adds debug names to signals and memos.                                                                                    |

| Result     | Description                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `code`     | TSX with the compile-time functions replaced. It still needs Solid's JSX compiler.                                                                                 |
| `map`      | A source map from `code` to the file.                                                                                                                              |
| `css`      | `{ code, map }` with the styles of the component, or `undefined` when the file has no `<style>` blocks.                                                            |
| `warnings` | Problems that do not stop compiling, such as unused CSS selectors and accessibility problems. Each has `code`, `message`, `offset`, `length`, `line` and `column`. |

### `compileStructure`

`compileStructure` takes the same options and returns the TSX before the compile-time functions are replaced. Type checking uses this code, because the global declarations of the compile-time functions already describe it.

It also returns `generated`. Some code in the TSX has no text in the file, such as the `each` prop that `#for` generates, or the assignment that `bind:value` generates. TypeScript can report errors on that code, so each entry maps it to the text in the file that it comes from. `@solid-sfc/language-core` adds these to its mappings, so the errors show up in the file.

### `SFCError`

Syntax errors throw an `SFCError`.

```ts
import { compile, SFCError } from 'solid-sfc';

try {
  compile(source, { filename });
} catch (error) {
  if (error instanceof SFCError) {
    console.error(error.line, error.column, error.message);
  }
}
```

| Property         | Description                                                            |
| ---------------- | ---------------------------------------------------------------------- |
| `message`        | The error and its location, such as `Expected </div> (App.solid:3:5)`. |
| `line`, `column` | The location, starting at 1.                                           |
| `offset`         | The location as an index into the source.                              |
| `filename`       | The `filename` option.                                                 |

## Runtime

Compiled components import helpers from `solid-sfc/runtime`:

- `mergeStyle(style, variables)` merges a `style` attribute with the CSS variables of the component.
- `key(source, render)` implements `#key`. It renders again when `source()` changes.
- `listen(target, type, listener)` implements `<solid:window>` and `<solid:document>`.

They are internal. Their names and signatures can change in any release.
