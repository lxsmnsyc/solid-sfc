# Outcome: fix-postfix-value

## Built

- `packages/solid-sfc/src/labels/reactive.ts`: `rewriteWrite` returns the old value for a postfix update whose value is used (temporary variable). Prefix and unused updates (statement, for-update) keep the short form.
- `packages/solid-sfc/test/labels/signal-writes.test.ts`: runs compiled output for `x++`, `x--`, `x!++`, `++x` and unused forms.
- `packages/solid-sfc/src/labels/CLAUDE.md`: sync note updated.
- `.changeset/old-value-postfix.md`: patch for `solid-sfc`.
- PR: https://github.com/lxsmnsyc/solid-sfc/pull/17

## Proof

- base: 4d3e624, `pnpm --filter solid-sfc exec vitest run test/labels/signal-writes.test.ts`: failed, `y` was 1, expected 0.
- branch: same command: 4 passed.

## Deviations

- `packages/solid-sfc/test/__snapshots__/compile.test.ts.snap` changed by one line (outside owned paths): `onClick={() => count++}` is a concise arrow body, so its value is used and it gets the temporary form, as upstream does.
- Test uses the labels transform with a stub `createSignal`, not a bundled `.solid` file.

## Stubs left

- None.

## Gotchas

- A for-update sequence (`x++, i++`) is not detected as unused and takes the long form; the result is still correct.

## Proposed learnings

- None.

## Verification

- `pnpm build`, `pnpm --filter solid-sfc test` (379 passed), `pnpm typecheck`, `./node_modules/.bin/oxlint`: pass. `oxfmt --check`: only website/index.html and website/preview.html (not changed here).

## Size

- Estimated S, actual S.
