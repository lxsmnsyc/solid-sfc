---
id: test-compile-pbt
title: Property tests for the compiler and the block scanner
status: todo
priority: should
type: feature
milestone: quality
size: M
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/test/compile.pbt.test.ts
  - packages/solid-sfc/test/arbitraries/**
depends_on:
  - on: deps-minor
    kind: hard
    why: needs fast-check
---

# Property tests for the compiler and the block scanner

## Goal

Generate `.solid` sources from a grammar (script, `<script module>`, style, template with elements, attributes, `#if`/`#for`/other control blocks and expressions) and check:

- `compile()` either returns or throws the compiler's own error type (`src/error.ts`) with a location inside the source. Never a raw `TypeError`.
- Output parses with oxc-parser with no errors.
- Source map: every mapped original position is inside the source, and mapped generated positions are inside the output.
- Scanner (`src/scanner.ts`): block boundaries reproduce the input when the blocks are joined.

## Acceptance

- [ ] Properties in `pnpm test`, 300+ runs, under 10 s.
- [ ] Findings listed in the outcome, each with a shrunk repro, for follow-up fix nodes.

## Sizing

M: grammar arbitrary is the main work.
