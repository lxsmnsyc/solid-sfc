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

A new design for `website/` following the frozen contract `contracts/web-design.md` v3 ("Unfold"). The first attempt (v1/v2, editorial and static) was rejected by the user as too basic compared to their other sites (solid-optimizer, atemno, compostate). Reference screenshots of those sites: `reviews/ref/`.

## Children

- web-design-system (rework, PR #11): v3 tokens, atmosphere, shell, shared UI components. Gate: user reviews the shell and a hero prototype before the rest starts.
- web-hero: live hero editor with lazy compiler and preview.
- web-unfold: the scroll-driven unfolding file scene with build-time outputs.
- web-home: home composition, live feature demos, build-time numbers band.
- web-docs: docs layout and cmd-K search. web-playground: playground restyle and share links.
- web-og-image: Open Graph image in v3, alias cleanup.

## Acceptance

- [ ] The user approves the result against their other sites.
- [ ] Light and dark pass WCAG AA; focus visible; reduced motion honored.
- [ ] Lighthouse accessibility 100 and performance 95+ on home.
- [ ] `pnpm --filter website build` and `typecheck` pass.
