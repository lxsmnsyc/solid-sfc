# Solid SFC

Language support for [`solid-sfc`](https://github.com/lxsmnsyc/solid-sfc) `.solid` files.

- Syntax highlighting for scripts, styles, markup and `#` control flow blocks.
- Type checking, hover, completion and go-to-definition in scripts and markup.
- CSS language features in `<style>` blocks.
- Syntax errors and warnings in the markup.
- Completion for `#` blocks and `<solid:` elements, and code actions that wrap markup in a block or extract it to a `#template`.
- Folding of blocks, and snippets for `<script>`, `<style>` and a component.

The extension includes its own TypeScript 6 compiler, so it works with any TypeScript version in the project.

To type-check `.solid` files from the command line, use [`@solid-sfc/tsc`](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/tsc).
