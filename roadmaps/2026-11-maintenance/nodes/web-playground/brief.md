---
id: web-playground
title: Website playground redesign
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
    why: the page is judged against the real shell and shared classes, not a stub
---

# Website playground redesign

## Goal

Restyle `website/src/pages/Playground.solid` and the preview frame per `contracts/web-design.md` as a full-height tool: a slim mono toolbar (example picker, output tabs), the editor and the output or preview in panes split by hairlines, pane titles as margin-style labels (`App.solid`, `out.js`, `preview`), errors shown in a mono strip in `--caution` with the location. Keep every current feature working.

## Context

The editor scroll sync and highlighting exist (commit `6d91464`); keep them. `website/src/preview/frame.ts` runs the preview iframe; its styles should use the same tokens (pass them in or duplicate the token block, say which in the outcome).

## Acceptance

- [ ] Every playground example compiles and previews as before.
- [ ] Panes stack on narrow screens with a tab switcher.
- [ ] Build and typecheck pass.

## Sizing

M.
