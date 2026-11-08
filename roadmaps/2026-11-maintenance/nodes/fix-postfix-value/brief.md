---
id: fix-postfix-value
title: Postfix update on a $signal returns the old value
status: done
priority: must
type: fix
milestone: 1.0.x
size: S
added: 2026-11-08
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/labels/reactive.ts
  - packages/solid-sfc/test/labels/signal-writes.test.ts
shared:
  - .changeset/*.md
depends_on:
  - on: fix-scope
    kind: hard
    why: same rewriteWrite code in reactive.ts
---

# Postfix update on a $signal returns the old value

## Goal

`const y = x++` on a `$signal` compiles to `setX(current => ++current)`, so `y` gets the new value (1), not the old one (0). The same holds for `x!++`. Make a postfix update whose value is used return the old value; keep the short form when the value is unused.

## Context

- Evidence: found by the fresh review of PR #9 (https://github.com/lxsmnsyc/solid-sfc/pull/9#pullrequestreview-5815844502), present on main `1ca2128`.
- Upstream solid-labels handles it in `rewriteWrite` with an `unused` check and a temporary variable (`packages/core/compiler/reactive.ts` on `1.0`, see PR #60 merge `a7a4ba7`). Port that logic; update the sync note in `packages/solid-sfc/src/labels/CLAUDE.md` (minimal deviation).

## Acceptance

- [ ] Failing test on the base: run the compiled output of `let x = $signal(0); const y = x++;` and check `y === 0` and `x() === 1`; same for `x--`, `x!++`.
- [ ] Unused postfix (`x++;` as a statement, for-update) keeps the short form; snapshots unchanged for it.
- [ ] Patch changeset for `solid-sfc`.

## Sizing

S: one function, upstream reference exists.
