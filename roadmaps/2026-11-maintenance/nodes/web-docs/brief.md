---
id: web-docs
title: Website docs pages redesign
status: todo
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/pages/Docs.solid
  - website/src/docs.ts
  - website/plugins/**
depends_on:
  - on: web-design-system
    kind: hard
    why: the page is judged against the real shell and shared classes, not a stub
---

# Website docs pages redesign

## Goal

Rebuild `website/src/pages/Docs.solid` per `contracts/web-design.md`: a left index of pages in mono with numbers, prose in a `--measure` column with display serif h1 and h2, an "On this page" list at right on wide screens, hairline-separated sections, alerts restyled as margin-ruled notes with a mono label (NOTE, TIP, ...), code blocks with block-hue rules (a `.solid` code sample gets per-block hues if the markdown plugin can tag them), and previous and next links at the foot.

## Context

Markdown is rendered by `website/plugins/markdown.ts` (markdown-it). The docs content in `website/docs/*.md` is not owned here; do not edit it.

## Acceptance

- [ ] Mobile: index collapses into a disclosure above the content; no horizontal scroll at 320px except inside code blocks.
- [ ] Heading anchors keyboard reachable; current page and section marked.
- [ ] Build and typecheck pass.

## Sizing

M.
