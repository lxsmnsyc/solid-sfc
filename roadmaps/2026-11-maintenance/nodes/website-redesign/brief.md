---
id: website-redesign
title: Redesign the website
status: active
priority: should
type: story
milestone: website
outline: false
size: L
gate: false
depends_on: []
---

# Redesign the website

## Goal

A new visual design for `website/` following the frozen contract `contracts/web-design.md` ("Source and output"). The user asked for an award-level design and left the direction to us (2026-11-08).

## Children

- web-design-system: tokens, fonts, shell (header, footer), shared classes, highlight theme, favicon.
- web-home, web-docs, web-playground: one page each, in parallel after the design system.
- web-og-image: the Open Graph image in the new style, and removal of the old token aliases.

## Acceptance

- [ ] Every page uses only contract tokens; no hard-coded colors outside `App.solid` tokens and the highlight theme.
- [ ] Light and dark pass WCAG AA for text; keyboard focus visible everywhere; `prefers-reduced-motion` honored.
- [ ] Lighthouse accessibility 100 and performance 95+ on the built home page.
- [ ] `pnpm --filter website build` and `pnpm --filter website typecheck` pass.
