---
id: web-og-image
title: Open Graph image in the v3 design, drop old token aliases
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

PR #8 shipped an image in the rejected v1 design. Redraw `website/public/og.png` in contract v3 (dark, glow, heavy display type, block hues; use the hero's look) from an HTML source committed at `website/og/og.html` with `website/og/render.sh` (headless Chrome, `--window-size=1200,630 --force-device-scale-factor=1 --screenshot`). The v1 source in `nodes/web-og-image/og-source.html` shows the rendering setup. Then remove the old token aliases from `App.solid` and fix remaining uses.

## Acceptance

- [ ] `og.png` 1200x630, under 200 KB.
- [ ] `grep -rn -- '--background\|--code-background\|--text)' website/src` finds nothing.
- [ ] Build and typecheck pass.

## Sizing

S.
