# SSR example

A `.solid` app rendered on the server with the start mode of `@solidjs/vite-plugin`. It streams a `#loading` block and hydrates in the browser.

- [`App.solid`](./src/App.solid) is the app: scoped styles with a reactive value, an async `$memo` in `#loading`, `#for`, and a dynamic tag whose tag changes with the count.
- [`Document.solid`](./src/Document.solid) is the HTML document around it, with `<solid:hydration-script />`.

`solid-sfc/vite` finds `src/App.solid` and `src/Document.solid` when `start` is set, so [`vite.config.ts`](./vite.config.ts) only sets `start: true` and `ssr: true`.

Run it from the root of the repository. `pnpm build` builds the packages that the example uses.

```bash
pnpm install
pnpm build
pnpm --filter ssr dev
```

`pnpm --filter ssr build` builds the client and the server, and `pnpm --filter ssr preview` serves the build.
