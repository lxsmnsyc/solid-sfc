# Outcome: fix-scope

## Built

- `packages/solid-sfc/src/labels/scope.ts`: ported solid-labels b538dbc (name scopes for named function and class expressions, separate body var scope when parameters have defaults) and the scope.ts part of PR #60 (for-in/for-of heads and update targets via `visitAssignTarget`). The 3 `JSXName.binding` lines are kept.
- `packages/solid-sfc/src/labels/CLAUDE.md`: names the upstream path and the synced commit.
- `packages/solid-sfc/src/labels/reactive.ts`: PR #60 TS wrapper skip in `rewriteWrite` (`x!++`, `(x as T)++`); for-of/for-in heads now reach the existing "Unsupported write" error.
- `packages/solid-sfc/test/labels/scope.test.ts`: 9 tests. `signal-writes.test.ts`: 2 tests (compiled output parsed with oxc-parser).
- `.changeset/quiet-scopes-fix.md`: patch for `solid-sfc`.
- Draft PR: https://github.com/lxsmnsyc/solid-sfc/pull/9

## Proof

- base: 1ca2128, `pnpm exec vitest run test/labels/scope.test.ts` (in packages/solid-sfc): 7 failed, 2 passed.
- branch: same command: 9 passed.
- base: signal-writes.test.ts at origin/main sources: 2 failed (1 oxc parse error on `x!++` output; for-of did not throw). branch: 2 passed.

## Deviations

- The `unused` handling in upstream `rewriteWrite` does not exist in our copy, so only the TS wrapper skip was ported by hand.
- PR #60 was still open (head 9ad98b3) at port time, so the sync note says so.
- The function-expression-name case already passed on main; kept as a regression test.

## Stubs left

- None.

## Gotchas

- Update the commit in `src/labels/CLAUDE.md` when PR #60 merges upstream.

## Proposed learnings

- Port upstream scope.ts fixes together with the reactive.ts changes that depend on them | both fail together on write targets | packages/solid-sfc/src/labels | no

## Verification

- `pnpm build && pnpm test && pnpm typecheck`: pass. `./node_modules/.bin/oxlint`: clean. `./node_modules/.bin/oxfmt --check`: clean.

## Size

- Estimated M, actual S.
