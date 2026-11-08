---
id: web-home
title: Website home page redesign
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/pages/Home.solid
  - website/src/content/**
depends_on:
  - on: web-design-system
    kind: hard
    why: the page is judged against the real shell and shared classes, not a stub
---

# Website home page redesign

## Goal

Rebuild `website/src/pages/Home.solid` per `contracts/web-design.md`. Hero: a huge display serif headline (an idea like "One file. Three parts. Zero runtime ceremony." — write your own, short), one line of body, two buttons (Get started, Playground). Beside or below it, the signature: a short `.solid` example whose script, style and markup are labeled in the margin with their hues, and a reveal that shows the compiled Solid output next to it (precompiled at build time from `content/example.md`, no compiler in the home chunk). Then the features as a numbered editorial list (01, 02, ...) with hairlines, not cards, and a closing install line (`npm i solid-sfc`) with a copy button.

## Acceptance

- [ ] No compiler or wasm in the home page chunk (check the build output).
- [ ] Layout works from 320px to 1600px; hero headline never overflows.
- [ ] Reveal motion off under `prefers-reduced-motion`; content readable without JS animation.
- [ ] Build and typecheck pass.

## Sizing

M.
