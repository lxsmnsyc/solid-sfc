# Outcome: fix-scope

## Built

- `packages/solid-sfc/src/labels/scope.ts`: ported solid-labels b538dbc (name scopes for named function and class expressions, separate body var scope when parameters have defaults) and the scope.ts part of PR #60 (for-in/for-of heads and update targets via `visitAssignTarget`). The 3 `JSXName.binding` lines are kept.
- `packages/solid-sfc/src/labels/CLAUDE.md`: names the upstream path and the synced commit.
- `packages/solid-sfc/test/labels/scope.test.ts`: 9 tests.
- `.changeset/quiet-scopes-fix.md`: patch for `solid-sfc`.
- Draft PR: https://github.com/lxsmnsyc/solid-sfc/pull/9

## Proof

- base: 1ca2128, `pnpm exec vitest run test/labels/scope.test.ts` (in packages/solid-sfc): 7 failed, 2 passed.
- branch: same command: 9 passed.

## Deviations

- The reactive.ts half of PR #60 is not ported (not an owned path). Compiled `.solid` output for `$signal` writes through `x!++` or a for-of head is therefore not covered by a validity test; that acceptance item is not met. Needs a decision.
- PR #60 was still open (head 9ad98b3) at port time, so the sync note says so.
- The function-expression-name case already passed on main; kept as a regression test.

## Stubs left

- None.

## Gotchas

- reactive.ts here has no TS wrapper handling in `rewriteWrite`; `x!++` on a `$signal` likely still emits `x()!++`.
- Update the commit in `src/labels/CLAUDE.md` when PR #60 merges upstream.

## Proposed learnings

- Port upstream scope.ts fixes together with the reactive.ts changes that depend on them | both fail together on write targets | packages/solid-sfc/src/labels | no

## Verification

- `pnpm build && pnpm test && pnpm typecheck`: pass. `./node_modules/.bin/oxlint`: clean. `./node_modules/.bin/oxfmt --check`: clean.

## Size

- Estimated M, actual S. Both patches applied cleanly.
