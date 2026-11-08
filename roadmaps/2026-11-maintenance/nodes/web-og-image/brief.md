---
id: web-og-image
title: Open Graph image in the new design, drop old token aliases
status: todo
priority: should
type: feature
story: website-redesign
size: S
verify: pnpm --filter website build
owns:
  - website/public/og.png
  - website/src/App.solid
depends_on:
  - on: og-tags
    kind: hard
    why: replaces the image og-tags adds
  - on: web-home
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

Make `website/public/og.png` (1200x630) in the new design: paper background, the display serif wordmark, the three-band block mark, one line of tagline. Render it from an SVG or HTML source with a script kept in `website/scripts/` if that is simpler, and commit the PNG. Then remove the old token aliases from `App.solid` and fix any remaining use.

## Acceptance

- [ ] `og.png` 1200x630, under 200 KB.
- [ ] `grep -rn -- '--background\|--code-background\|--text)' website/src` finds nothing.
- [ ] Build and typecheck pass.

## Sizing

S.
