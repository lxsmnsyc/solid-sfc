---
id: web-og-image
title: Commit the Open Graph image source, drop old token aliases
status: todo
priority: should
type: feature
story: website-redesign
size: S
verify: pnpm --filter website build
owns:
  - website/public/og.png
  - website/og/**
  - website/src/App.solid
depends_on:
  - on: og-tags
    kind: hard
    why: replaces the image og-tags adds
  - on: web-home
    kind: hard
    why: aliases can go only after every page moved
  - on: web-hero
    kind: hard
    why: the image uses the final hero look
  - on: web-unfold
    kind: hard
    why: aliases can go only after every page moved
  - on: web-docs
    kind: hard
    why: aliases can go only after every page moved
  - on: web-playground
    kind: hard
    why: aliases can go only after every page moved
---

# Open Graph image in the new design, drop old token aliases

## Goal

The v3 `og.png` shipped in PR #8 (2026-11-08). Its HTML source is `nodes/web-og-image/og-source.html` in this roadmap, with absolute `file://` font paths. Commit it as `website/og/og.html` with font URLs relative to `website/public/fonts/`, and add `website/og/render.sh` that renders it with headless Chrome (`--window-size=1200,630 --force-device-scale-factor=1 --screenshot`). Re-render only if the hero changed in a way the image should follow (headline, sample code). Then remove the old token aliases from `App.solid` and fix remaining uses.

## Acceptance

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] `og.png` 1200x630; `website/og/render.sh` reproduces it.
- [ ] `grep -rn -- '--background\|--code-background\|--text)' website/src` finds nothing.
- [ ] Build and typecheck pass.

## Sizing

S.
