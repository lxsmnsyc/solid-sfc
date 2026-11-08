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
  - website/src/ui/**
  - website/src/router.ts
  - website/src/home/Hero.solid
  - website/src/home/Unfold.solid
provides: [web-design]
depends_on: []
---

# Website design system and shell

## Goal

Rework PR #11 to contract v3 ("Unfold"): v3 tokens for dark and light, the atmosphere layer (glow, grid, noise), the shell (glass header with version badge, nav, GitHub icon, theme toggle; footer), shared UI in `website/src/ui/` (`CodeBlock`, `CopyCommand`) and global classes, a v3 highlight theme, the favicon and logo mark. Also build a hero prototype as a static page section in `website/src/ui/HeroPreview.solid` (headline, gradient words, buttons, install tabs, a non-live code panel) so the user can judge the direction before the other children start. Create `website/src/home/Hero.solid` (renders the hero prototype) and `website/src/home/Unfold.solid` (an empty section) as stubs that web-hero and web-unfold take over, and have `Home.solid` import them (minimal edit, deviation allowed). Keep old token names aliased until web-og-image.

## Context

- Contract: `contracts/web-design.md` v3. Reference screenshots of the user's other sites: `reviews/ref/*.png`. Match that family's richness, then go past it.
- Fix the PR #11 review findings (https://github.com/lxsmnsyc/solid-sfc/pull/11#pullrequestreview-5815874247): header height off by 1px against the playground's `calc(100vh - var(--header-height))`; skip link does not move focus (router cancels the jump; `router.ts` is now owned, fix it there); remove the dead `.name` duplicate of `.visually-hidden`; ship the Geist weights you use (700, 800 for display) and no unused ones.
- Fonts: self-hosted woff2 from `@fontsource/geist` on jsDelivr, OFL included. Drop Instrument Serif.

## Acceptance

- [ ] Every `.solid` sample on the page follows `contracts/solid-idioms.md` (shorthands, bare values, no needless parentheses, control flow blocks).

- [ ] Screenshots, light and dark, 1440 and 390 wide, of home with the hero prototype in place, docs and playground, saved to the scratchpad and listed in the outcome.
- [ ] AA contrast for every text pair; focus ring visible; reduced motion honored.
- [ ] `pnpm --filter website build`, `typecheck`, `oxfmt --check` pass.

## Notes for the worker

- Do not edit `website/index.html`.
- Gate: the orchestrator shows your screenshots to the user before hero, unfold, home, docs and playground start.
