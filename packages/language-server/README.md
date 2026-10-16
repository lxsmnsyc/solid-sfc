# @solid-sfc/language-server

> A language server for `solid-sfc` `.solid` files.

It provides type checking, hover, completion, go-to-definition and the other TypeScript features in scripts and markup, CSS features in `<style>` blocks, and markup syntax errors and warnings. It also completes `#` blocks and `<solid:` elements, and has code actions that wrap markup in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`.

The [VS Code extension](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/vscode) includes this server. Other editors can run it over stdio:

```bash
pnpm add -g @solid-sfc/language-server
solid-sfc-language-server --stdio
```

The server includes its own copy of TypeScript 6, because TypeScript 7 has no JavaScript API.

## License

MIT
