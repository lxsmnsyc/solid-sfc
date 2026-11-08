---
id: web-playground
title: Playground restyle and share links
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/pages/Playground.solid
  - website/src/preview/**
  - website/src/examples.ts
depends_on:
  - on: web-design-system
    kind: hard
    why: builds on the v3 shell and shared UI after the user approves them (gate)
---

# Playground restyle and share links

## Goal

Restyle `website/src/pages/Playground.solid` and the preview frame per contract v3 as a full-height tool: glass toolbar (example picker, output tabs, share button), editor and output panes with a draggable divider, errors in a mono strip. Add share links: the source is compressed into the URL hash and restored on load.

## Acceptance

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] Every example compiles and previews as before; a shared link restores the source.
- [ ] Panes stack on narrow screens with a tab switcher.
- [ ] Build and typecheck pass.

## Sizing

M.
