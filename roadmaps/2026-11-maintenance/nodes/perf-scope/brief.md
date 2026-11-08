---
id: perf-scope
title: Cut allocation in scope analysis
status: todo
priority: should
type: refactor
milestone: quality
size: M
exclusive: [bench]
owns:
  - packages/solid-sfc/src/labels/scope.ts
  - packages/solid-sfc/src/labels/*.ts
shared:
  - .changeset/*.md
depends_on:
  - on: bench
    kind: hard
    why: needs the baseline and profile
  - on: fix-scope-48
    kind: hard
    why: same file
---

# Cut allocation in scope analysis

## Goal

Every `Ref` copies its ancestor chain (`parents: Node[]`). solid-labels tried removing that copy (PR #56, closed) and switched to oxc raw transfer (PR #57, merged). Check whether the bench profile places cost in `analyze()` or parsing; if so, apply the matching change and measure.

## Context

- Evidence: to be taken from bench's profile. If scope and parsing are under 10% of compile time in the profile, close this node as not needed with the numbers.

## Acceptance

- [ ] Before and after medians from the bench, gain above noise, or node dropped with numbers.
- [ ] Upstream note: same change proposed to solid-labels if it applies there.

## Sizing

M.
