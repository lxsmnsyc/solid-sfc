# solid-sfc

> Single-file components for SolidJS 2.0.

[![NPM](https://img.shields.io/npm/v/solid-sfc.svg)](https://www.npmjs.com/package/solid-sfc)

Read the [documentation](./docs/README.md) to get started.

## Packages

- [`solid-sfc`](./packages/solid-sfc) is the compiler and the Vite plugin.
- [`@solid-sfc/language-core`](./packages/language-core) is the Volar language plugin.
- [`@solid-sfc/tsc`](./packages/tsc) type-checks projects with `.solid` files.
- [`@solid-sfc/language-server`](./packages/language-server) is the language server.
- [`@solid-sfc/typescript-plugin`](./packages/typescript-plugin) lets `.ts` files import `.solid` files with their props types in the TypeScript server.
- [`solid-sfc-vscode`](./packages/vscode) is the VS Code extension.

## Examples

- [`tasks`](./examples/tasks) is a task board that uses every feature of `.solid` files.
- [`ssr`](./examples/ssr) renders a `.solid` app on the server with start mode and hydrates it.

## Development

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
pnpm format
pnpm typecheck
```

Add a changeset for each user-facing change with `pnpm changeset`.

`pnpm vscode` builds the packages and opens `examples/tasks` in a VS Code window that runs the extension from `packages/vscode`. Run it again after a change, or rebuild and run "Developer: Reload Window" in that window.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
