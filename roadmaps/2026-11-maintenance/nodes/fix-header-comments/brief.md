---
id: fix-header-comments
title: Comments and regexes in control flow block headers
status: todo
priority: should
type: fix
milestone: 1.0.x
size: M
added: 2026-11-08
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/control.ts
  - packages/solid-sfc/test/control.test.ts
  - packages/solid-sfc/test/compile.pbt.test.ts
shared:
  - .changeset/*.md
depends_on:
  - on: test-compile-pbt
    kind: hard
    why: its it.fails cases for these findings become the acceptance tests
---

# Comments and regexes in control flow block headers

## Goal

Two findings from test-compile-pbt (PR #21):

1. A `#for` header breaks on a comment or regex that holds `}`, `)` or the word `by`: `findWord` in `control.ts` skips neither. Repro: `#for (item of list /* } */ by item.id) {\n<p />\n}` throws "Expected `}`".
2. A `//` comment at the end of a block header swallows the `}` the compiler writes next, so the output does not parse and the error points at the wrong line. Repro: `#if (a // note\n) {\n<p />\n}`. Same for `#else if`, `#case`, `#repeat`, `#portal`, `#for`.

## Acceptance

- [ ] The two `it.fails` cases in `compile.pbt.test.ts` become `it` and pass; a unit test per header kind in `control.test.ts`.
- [ ] Header scanning reuses the scanner's comment, string, template and regex skipping instead of a second ad hoc pass, if that is the smaller change.
- [ ] Patch changeset.

## Sizing

M: one module, several header kinds.
