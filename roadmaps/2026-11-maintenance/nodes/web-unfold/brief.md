---
id: web-unfold
title: Unfolding file scroll scene
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/home/Unfold.solid
  - website/src/home/unfold/**
  - website/plugins/unfold.ts
  - website/vite.config.ts
depends_on:
  - on: web-design-system
    kind: hard
    why: builds on the v3 shell and shared UI after the user approves them (gate)
---

# Unfolding file scroll scene

## Goal

Contract v3 item 4, the signature of the site. A `.solid` file card in 3D perspective; on scroll its script, style and markup blocks lift apart into three layers, and connectors draw from each layer to what it becomes: the component function, the scoped CSS with its hashed attribute, and the DOM it renders. Outputs come from the real compiler at build time through a Vite plugin (`website/plugins/unfold.ts`, virtual module), so they never drift from the compiler.

## Acceptance

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] CSS scroll-driven animation where supported, IntersectionObserver fallback elsewhere; 60 fps on a mid laptop (no layout thrash: transforms and opacity only).
- [ ] Reduced motion: static final state. Screen readers get the three outputs as labeled code.
- [ ] Mobile: layers stack vertically, still animated.
- [ ] Build and typecheck pass.

## Sizing

M: one scene, build-time plugin.

## Notes for the worker

- `website/vite.config.ts`: only add the plugin.
