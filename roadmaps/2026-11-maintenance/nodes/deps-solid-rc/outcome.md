# Outcome: deps-solid-rc

Branch `chore/deps-solid-rc`, PR #19, ready for review.

## Built

- solid-js, @solidjs/web, @solidjs/signals, @solidjs/compiler (and wasm binding): 2.0.0-rc.15 -> rc.21. @solidjs/vite-plugin next.35 -> next.57. terracotta next.10 -> next.11.
- Removed the `minimumReleaseAgeExclude` list; rc.21 passes the age policy.
- `packages/solid-sfc/src/vite.ts`: `withStyleExclude` adds `/\?solid-sfc&type=style/` to the Solid plugin `exclude` (user patterns kept), because next.57 matches `.solid?query` ids and compiled the CSS modules as JS. `renameManifestModules` accepts the old array and the new `{ modules, functions, buildId }` manifest and keeps the other keys.
- `packages/solid-sfc/test/vite.test.ts`: 5 tests for both.
- One patch changeset for `solid-sfc`.

## Snapshot changes

- None.

## Deviations

- Edited `vite.ts` after the coordinator added it to the node's paths.

## Gotchas

- `oxfmt --check` fails on `website/index.html` and `website/preview.html` (fixed by PR #18).
- `test/bundlers.test.ts` can time out on the first run after install; it passes on rerun.
- The ssr build's `.vite/solid-server-functions.json` has empty `modules` and `functions`; the example works anyway.

## Verification

- build, test (382 + 50 + 21), typecheck, oxlint pass. oxfmt only fails on the two website files above.
- website, tasks and ssr builds pass.
- SSR: `pnpm --filter ssr preview`, fetched `/`: server HTML holds the rendered app (heading, count, list, streamed Loading template, server time). Headless Chrome (dump-dom after 8s): the Loading block resolved to "Hello, server", no console errors or uncaught exceptions. Button clicks were not tested.

## Size

- Estimated M, actual M.
