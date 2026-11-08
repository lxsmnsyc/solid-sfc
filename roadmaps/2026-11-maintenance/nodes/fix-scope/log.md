# Log: fix-scope

- Reset to origin/main (1ca2128), pnpm install, pnpm build.
- Wrote packages/solid-sfc/test/labels/scope.test.ts (9 tests) first.
- Base proof: `pnpm exec vitest run test/labels/scope.test.ts` in packages/solid-sfc at 1ca2128: 7 failed, 2 passed (for-of, for-in, destructuring for-of, `x!++`, class expression name, JSX class name, parameter default vs body var). The function-expression-name case and the body-var control already passed on main.
- Ported b538dbc scope.ts diff and the scope.ts part of PR #60 (head 9ad98b3, open) with `patch`; both applied cleanly. Our copy matched upstream b538dbc~1 except the import path and the 3 JSXName.binding lines.
- Branch: same command, 9 passed.
- Fast check passed (373 + 50 + 21 tests), oxlint clean, oxfmt clean.
- PR #60 also changes reactive.ts (TS wrappers on update targets, "Unsupported write" for for-of heads). Not owned by this node, not ported.
- Draft PR: https://github.com/lxsmnsyc/solid-sfc/pull/9
- Follow-up (reactive.ts now owned): wrote test/labels/signal-writes.test.ts. Base (origin/main scope.ts and reactive.ts), `pnpm --filter solid-sfc exec vitest run test/labels/signal-writes.test.ts`: 2 failed (`x!++` output had 1 oxc parse error; for-of did not throw). Branch: 2 passed.
- The PR #60 reactive.ts patch applied only in part (our copy has no `unused` logic); the TS_WRAPPERS skip was applied by hand. Fast check 375+50+21 passed, oxlint and oxfmt clean. Commit 9b17dcd pushed, PR body updated.
