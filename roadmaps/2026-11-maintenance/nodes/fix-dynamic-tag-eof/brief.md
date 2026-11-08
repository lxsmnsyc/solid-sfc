---
id: fix-dynamic-tag-eof
title: Dynamic tag closing at end of file compiles to broken TSX
status: done
priority: must
type: fix
milestone: 1.0.x
size: S
added: 2026-11-08
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/template.ts
  - packages/solid-sfc/src/scanner.ts
  - packages/solid-sfc/src/layout.ts
  - packages/solid-sfc/test/template-eof.test.ts
shared:
  - .changeset/*.md
depends_on: []
---

# Dynamic tag closing at end of file compiles to broken TSX

## Goal

A `.solid` file with a `<script>` whose markup ends in a dynamic tag's `</>` with no trailing newline compiles to invalid TSX (`Unexpected token (2:44)`). The playground editor and the language server see files without a trailing newline, so it matters there. Find which stage drops or misplaces the end and fix it.

## Context

- Evidence: found by examples-idioms (PR #13). The "Dynamic tags" sample in `website/docs/markup.md` with its final newline removed fails on main `1ca2128`. With a trailing newline it compiles.
- Check the same input in `@solid-sfc/language-core`'s `compileForEditor` too, and fix there if it shares the cause (minimal deviation allowed).

## Acceptance

- [ ] A test that fails on main: compile the sample without a trailing newline and parse the output with oxc-parser; no errors after the fix. Also cover a plain element and a component at end of file without a newline.
- [ ] Patch changeset for `solid-sfc`.

## Sizing

S.
