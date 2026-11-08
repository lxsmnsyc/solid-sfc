---
id: fix-css-scope-edges
title: CSS scoping edge cases and selector errors
status: todo
priority: should
type: fix
milestone: 1.0.x
size: S
added: 2026-11-08
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/style.ts
  - packages/solid-sfc/test/style.test.ts
  - packages/solid-sfc/test/compile.pbt.test.ts
shared:
  - .changeset/*.md
depends_on:
  - on: test-css-pbt
    kind: hard
    why: same scoping code; its fixes land first
  - on: test-compile-pbt
    kind: hard
    why: its it.fails case for the selector error becomes the acceptance test
  - on: fix-header-comments
    kind: hard
    why: both flip it.fails cases in compile.pbt.test.ts
---

# Scope a compound with a trailing :global() and keep url() names in animation values

## Goal

Findings from test-css-pbt (PR #20) and test-compile-pbt (PR #21), left unfixed there:

1. `.a:global(.b)` is left unscoped. Decide from `website/docs/styles.md` what it should compile to (most likely `.a[s-x].b`: the local part scoped, the global part kept). If the docs do not say, ask the orchestrator before changing behavior.
2. In an `animation` value, `url(k)` is renamed when a keyframe named `k` exists. Names inside `url()` and strings must not be renamed.
3. An unbalanced selector (`<style>] {}</style><p />`, also `a)`, `a::`, `a]`) throws a raw `Error` from postcss-selector-parser instead of an `SFCError` with the location. Wrap it. The `it.fails` case in `compile.pbt.test.ts` becomes `it`.

## Acceptance

- [ ] A failing test per finding on main, passing after the fix; docs updated if the `:global()` rule was unclear.
- [ ] Patch changeset for `solid-sfc`.

## Sizing

S.
