---
id: web-docs
title: Docs layout and cmd-K search
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/pages/Docs.solid
  - website/src/docs.ts
  - website/src/docs/**
  - website/plugins/markdown.ts
depends_on:
  - on: web-prerender
    kind: hard
    why: pages are built SSR-safe on top of the start-mode shell and routes
  - on: web-design-system
    kind: hard
    why: builds on the v3 shell and shared UI after the user approves them (gate)
---

# Docs layout and cmd-K search

## Goal

Rebuild `website/src/pages/Docs.solid` per contract v5: left index, prose column, sticky on-this-page list, alerts as flat callouts tinted in their hue, `CodeBlock` with copy, prev and next pager, and a `cmd-K` search dialog over all docs headings and text (index built at build time in `website/plugins/markdown.ts`, no third-party service).

## Acceptance

- [ ] The page server-renders and prerenders (start mode, see web-prerender's outcome): no browser globals at module top level, no hydration mismatch.

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] Search opens with cmd-K and ctrl-K, is keyboard only usable, focus trapped and restored.
- [ ] Mobile index as a disclosure; no horizontal scroll at 320px outside code.
- [ ] Build and typecheck pass.

## Sizing

M.
