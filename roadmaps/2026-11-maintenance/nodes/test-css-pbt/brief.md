---
id: test-css-pbt
title: Property tests for CSS scoping and minification
status: done
priority: should
type: feature
milestone: quality
size: M
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/test/style.pbt.test.ts
  - packages/solid-sfc/test/minify.pbt.test.ts
depends_on:
  - on: deps-minor
    kind: hard
    why: needs fast-check
---

# Property tests for CSS scoping and minification

## Goal

fast-check properties for `minifyCSS` (`src/minify.ts`) and `processStyles` (`src/style.ts`):

- Oracle: `postcss.parse(minifyCSS(css))` equals `postcss.parse(css)` after normalizing whitespace and comments (same rules, selectors, declarations, values).
- Idempotence: `minifyCSS(minifyCSS(x)) === minifyCSS(x)`.
- Scoping: every scoped selector keeps its pseudo-elements last, `:global(...)` content is untouched, and every renamed `@keyframes` name matches its `animation` uses.
- Strings, `url()` and escapes survive minification byte for byte.

## Acceptance

- [ ] Properties run in `pnpm test`; failures report the seed and a shrunk input.
- [ ] Bugs found are fixed only if under 20 lines in `minify.ts` or `style.ts`; else listed in the outcome for a follow-up node.

## Sizing

M.

## Notes for the worker

- If you fix a bug in `src/`, add a changeset and say so in the outcome; `src/minify.ts` and `src/style.ts` are not owned by any other open node.
