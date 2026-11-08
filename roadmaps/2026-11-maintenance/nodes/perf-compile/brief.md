---
id: perf-compile
title: Fix the top compile hotspots from the profile
status: todo
priority: could
type: refactor
milestone: quality
size: M
exclusive: [bench]
owns:
  - packages/solid-sfc/src/template.ts
  - packages/solid-sfc/src/control.ts
  - packages/solid-sfc/src/compile.ts
  - packages/solid-sfc/src/layout.ts
  - packages/solid-sfc/src/style.ts
  - packages/solid-sfc/src/minify.ts
shared:
  - .changeset/*.md
depends_on:
  - on: bench
    kind: hard
    why: needs the profile
  - on: test-compile-pbt
    kind: hard
    why: the properties guard the rewrite of compile code
---

# Fix the top compile hotspots from the profile

## Goal

Take the top self-time functions outside `labels/` from bench's profile (repeated parses, string concatenation, MagicString overuse, regex scans) and fix the ones with clear wins. One commit per hotspot with before and after numbers.

## Acceptance

- [ ] Each change shows a gain above noise on the bench; changes that do not are reverted.
- [ ] Snapshots unchanged.

## Sizing

M; uncertainty depends on the profile.
