---
id: web-design-system
title: Website design system and shell
status: active
priority: should
type: feature
story: website-redesign
size: M
verify: pnpm --filter website build
owns:
  - website/src/App.solid
  - website/src/theme.css
  - website/src/main.ts
  - website/public/fonts/**
  - website/public/favicon.svg
provides: [web-design]
depends_on: []
---

# Website design system and shell

## Goal

Implement `contracts/web-design.md`: the tokens (light and dark) and old-name aliases in the global style of `website/src/App.solid`, self-hosted Instrument Serif, Geist and Geist Mono woff2 files with their OFL licenses in `website/public/fonts/`, the shared classes, a header and a new footer, a syntax highlight theme in `website/src/theme.css` built from the tokens (replacing the GitHub theme imports), and a favicon with the three-band block mark.

## Context

- Current shell: `website/src/App.solid` (global style, header with Docs, Playground, GitHub). Pages: `website/src/pages/*.solid` keep working through the aliases.
- Fonts: download the latin woff2 subsets from the `@fontsource/instrument-serif`, `@fontsource/geist` and `@fontsource/geist-mono` packages on jsDelivr (`https://cdn.jsdelivr.net/npm/@fontsource/<name>/files/...`), and their `LICENSE`. Do not add npm dependencies; the lockfile belongs to the dependency nodes.
- Highlight classes come from twinkleplop; read `node_modules/@twinkleplop/theme-github/` for the selectors to restyle.

## Acceptance

- [ ] Header: wordmark with the block mark at left, mono uppercase nav at right, hairline under it, active page marked; usable at 320px wide.
- [ ] Footer: hairline, short colophon line, links (GitHub, npm, docs).
- [ ] Code highlight readable in both schemes, token colors from the contract hues.
- [ ] Fast keyboard focus ring (2px accent outline, offset 2px) on every interactive element.
- [ ] `pnpm --filter website build` and `pnpm --filter website typecheck` pass.

## Sizing

M: one shell file, a theme file, assets.

## Notes for the worker

- Do not edit `website/index.html`: og-tags owns it in parallel. Load fonts with `@font-face` in CSS.
- Read the ui-style skill before writing UI.
