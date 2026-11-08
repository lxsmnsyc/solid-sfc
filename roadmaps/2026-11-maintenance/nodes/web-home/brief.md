---
id: web-home
title: Home page sections and live demos
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/pages/Home.solid
  - website/src/home/demos/**
  - website/plugins/stats.ts
  - website/src/content/**
depends_on:
  - on: web-prerender
    kind: hard
    why: pages are built SSR-safe on top of the start-mode shell and routes
  - on: web-design-system
    kind: hard
    why: builds on the v3 shell and shared UI after the user approves them (gate)
---

# Home page sections and live demos

## Goal

Contract v5 items 6 and 7. Compose `website/src/pages/Home.solid`: hero and unfold (imported from `src/home/`), then live feature demos (`$signal` counter showing the setter call, `#for` with keys, scoped style toggle showing the attribute selector, `#loading` with a fake fetch), each with its source and the compiled line highlighted, compiled at build time; a build-time numbers band (compile time and output size of the example components, measured by `website/plugins/stats.ts`); a closing call to action. Demos run as real compiled `.solid` components in the page.

## Acceptance

- [ ] The page server-renders and prerenders (start mode, see web-prerender's outcome): no browser globals at module top level, no hydration mismatch.

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] Every demo works with keyboard and has a static fallback.
- [ ] No compiler or wasm in the home chunk.
- [ ] Build and typecheck pass.

## Sizing

M.
