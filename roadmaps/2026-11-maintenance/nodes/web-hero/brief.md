---
id: web-hero
title: Live hero editor on the home page
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/home/Hero.solid
  - website/src/home/hero/**
depends_on:
  - on: web-design-system
    kind: hard
    why: builds on the v3 shell and shared UI after the user approves them (gate)
---

# Live hero editor on the home page

## Goal

Contract v3 item 5. Replace the hero stub with the real hero: headline with gradient words, one line of copy, buttons, `CopyCommand`, and beside it an editable `.solid` snippet with a live preview. The compiler and its wasm load only on first focus of the editor or on idle; compile runs in a worker; show "compiled in N ms · N B". Before the compiler loads, show the build-time render so the hero is complete without JS.

## Context

- Reuse the playground's compile and preview code (`website/src/preview/`, `website/src/pages/Playground.solid`) by importing it; do not edit those files (web-playground owns them). If a function must move to be shared, write a change request on the web-design contract and copy it locally for now.
- Read web-design-system's outcome for the shared UI.

## Acceptance

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] Home initial chunk has no compiler or wasm (check build output); hero works with keyboard; edits update the preview within 300 ms after load.
- [ ] Compile errors show inline, mono, with the location, without breaking the preview.
- [ ] Build and typecheck pass.

## Sizing

M: reuses existing compiler loading.
