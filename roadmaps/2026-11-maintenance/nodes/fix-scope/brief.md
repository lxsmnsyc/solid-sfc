---
id: fix-scope
title: "Port solid-labels scope fixes for #46, #47 and #49"
status: active
priority: must
type: fix
milestone: 1.0.x
size: M
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/labels/scope.ts
  - packages/solid-sfc/src/labels/reactive.ts
  - packages/solid-sfc/src/labels/CLAUDE.md
  - packages/solid-sfc/test/labels/**
shared:
  - .changeset/*.md
depends_on: []
---

# Port solid-labels scope fixes for #46, #47 and #49

## Goal

Fix the scope bugs from issue #5 that solid-labels has fixed or has a fix in review for: `for (x of xs)` and `x!++` recorded as reads (solid-labels #46, PR #60), class expression inner name not declared (#47), parameter default resolving to a body `var` and function expression name shadowing a parameter (#49). Add a note next to the copy so the two stay in step.

## Context

- Source: issue #5. Upstream fix: `lxsmnsyc/solid-labels` commit `b538dbc` on `1.0` (#47, #49); PR #60 (#46), open at planning time. A local checkout is at `../solid-labels`.
- Evidence: `let x; for (x of []) {}` through `analyze()` gives `mode: 'read'` for the loop head `x` at `1ca2128` (issue #5 steps).

## Acceptance

- [ ] A failing test per bug is written first on the base, then passes. For `$signal` writes, the compiled `.solid` output is valid code (parse it with oxc).
- [ ] `packages/solid-sfc/src/labels/CLAUDE.md` says the file is a copy, names the upstream path and the last synced upstream commit.
- [ ] Patch changeset for `solid-sfc`.

## Sizing

M: known fix, port plus tests; uncertainty low.

## Notes for the worker

- Our copy adds 3 lines for `JSXName.binding`; keep them.
- If PR #60 changed before merging, port its latest head and say so in the outcome.
- #48 is out of scope (fix-scope-48).
