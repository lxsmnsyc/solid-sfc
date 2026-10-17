# @solid-sfc/typescript-plugin

> A TypeScript server plugin for `solid-sfc` `.solid` files.

Without it, a `.ts` or `.tsx` file that imports a `.solid` file only sees `declare module '*.solid'`, so the props of the component are not checked. With it, the TypeScript server reads `.solid` files and gives each import its props type.

The [VS Code extension](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/vscode) includes this plugin. In other editors that use the TypeScript server, add it to `tsconfig.json`:

```bash
pnpm add -D @solid-sfc/typescript-plugin
```

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "@solid-sfc/typescript-plugin" }]
  }
}
```

The plugin works with the JavaScript TypeScript server of TypeScript 5 and 6. The native TypeScript 7 server does not load plugins.

`solid-tsc` checks the same imports on the command line.

## License

MIT
