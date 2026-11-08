---
id: deps-majors
title: Bump markdown-it and postcss-less majors
status: todo
priority: could
type: chore
milestone: quality
size: S
verify: pnpm build && pnpm test && pnpm --filter website build
owns:
  - pnpm-lock.yaml
  - packages/solid-sfc/package.json
  - website/package.json
  - packages/solid-sfc/src/style.ts
  - website/vite.config.ts
  - website/plugins/**
shared:
  - .changeset/*.md
depends_on:
  - on: deps-solid-rc
    kind: hard
    why: lockfile and manifests
---

# Bump markdown-it and postcss-less majors

## Goal

`markdown-it` 14 -> 15 (website docs rendering, with `@types/markdown-it`) and `postcss-less` 6 -> 7 (Less parsing in `solid-sfc` styles). Read each changelog, adapt call sites.

## Acceptance

- [ ] Both on latest major, style tests for Less pass, docs pages render the same (spot-check alerts and code blocks).
- [ ] `@types/node` stays at 24 or lower and `typescript-api` at 6: write that in the outcome as dropped with reason.

## Sizing

S: two packages, small call sites.
