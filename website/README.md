# solid-sfc website

The documentation and the playground of solid-sfc, built with solid-sfc itself.

- [`docs/`](./docs) holds the documentation as Markdown. GitHub shows it as is, and the site renders it with [`plugins/markdown.ts`](./plugins/markdown.ts).
- Code is highlighted with [twinkleplop](https://twinkleplop.pngwn.at). [`src/highlight/solid.ts`](./src/highlight/solid.ts) is a twinkleplop language for `.solid` files.
- The playground runs the compiler in the browser. Its parser is WebAssembly with threads, which needs cross-origin isolation: the dev and preview servers send the headers, and on static hosts [`coi-serviceworker`](https://github.com/gzuidhof/coi-serviceworker) adds them.
- The preview of the playground removes types with `oxc-transform` and compiles the JSX with the WebAssembly build of `@solidjs/compiler`, both loaded when the preview first opens. [`preview.html`](./preview.html) runs the result in a frame with its own copy of Solid, so the component can import `solid-js`, `@solidjs/web` and `solid-sfc/runtime`.

Run it from the root of the repository. `pnpm build` builds the packages that the site uses.

```bash
pnpm install
pnpm build
pnpm --filter website dev
```

`pnpm --filter website build` writes a static site to `dist`. Set `BASE` when the site is served from a subpath, as in `BASE=/solid-sfc/ pnpm --filter website build`. The build includes a `404.html`, so static hosts open deep links.

## Deploying

[`vercel.json`](vercel.json) deploys the site to Vercel. It builds the packages that the site uses with `pnpm --filter "website^..." build` before the site, sends the cross-origin isolation headers, and serves `index.html` for the paths of the site. In the Vercel project:

- Set the root directory to `website`.
- Set `ENABLE_EXPERIMENTAL_COREPACK=1`, so Vercel installs the pnpm version in `packageManager`.
- Use Node.js 22 or later.
