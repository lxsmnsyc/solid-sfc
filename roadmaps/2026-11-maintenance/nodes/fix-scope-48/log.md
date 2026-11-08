# fix-scope-48 log

- Upstream check: solid-labels origin/1.0 (180dd87) already fixes #48 (PRs #61 and #64). Issue is closed. No open PR covers it. Fix is a port.
- Base: origin/main 4d3e624. Command: `pnpm --filter solid-sfc exec vitest run test/labels/scope.test.ts`
- Base result (new tests only): decorator FAIL, namespace FAIL, enum initializer FAIL, parameter property FAIL, import equals FAIL. All five reproduce, none dropped.
- Branch result (2f78648): 14 of 14 pass.
- Port: the scope.ts diff 9ad98b3..180dd87 from solid-labels applied cleanly to src/labels/scope.ts.
- Checks: build, test, typecheck, oxlint pass. oxfmt fails only on website/index.html and website/preview.html.
- upstream.patch is empty: upstream has the fix, nothing to apply.
- PR: https://github.com/lxsmnsyc/solid-sfc/pull/22 (draft). "Closes #5" not added: issue #5 not checked.
