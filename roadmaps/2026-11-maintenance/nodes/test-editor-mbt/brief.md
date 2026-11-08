---
id: test-editor-mbt
title: Model-based test of editor recovery and virtual code mappings
status: todo
priority: should
type: feature
milestone: quality
size: M
verify: pnpm --filter @solid-sfc/language-core test
owns:
  - packages/language-core/test/editor.mbt.test.ts
depends_on:
  - on: deps-minor
    kind: hard
    why: needs fast-check
---

# Model-based test of editor recovery and virtual code mappings

## Goal

The language plugin sees a `.solid` file through a stream of edits while the user types. Model it with `fc.commands`: start from a valid source, apply random insertions and deletions (characters, half-typed tags, unclosed blocks), and after each step check:

- `compileForEditor` (`src/recovery.ts`) never throws.
- Every Volar mapping of the virtual code has source and generated ranges inside their texts, and mapped source text equals mapped generated text where the mapping claims verification.
- Oracle: when the source is valid, the virtual code's TypeScript part type-checks the same as compiling the source fresh (same diagnostics count from `compileForEditor` on the final text versus after the edit sequence).
- Completions from `src/editing.ts` have `start <= cursor`.

## Acceptance

- [ ] Command-based property in `pnpm test`, under 10 s.
- [ ] Findings listed with shrunk command sequences.

## Sizing

M: MBT pattern new to repo.
