---
id: og-tags
title: Add Open Graph and Twitter card tags to the website
status: done
priority: should
type: feature
milestone: website
size: S
verify: pnpm --filter website build
owns:
  - website/index.html
  - website/preview.html
  - website/public/og.png
  - website/vite.config.ts
depends_on: []
---

# Add Open Graph and Twitter card tags to the website

## Goal

Close issue #4: `description`, canonical link, `og:type`, `og:site_name`, `og:title`, `og:description`, `og:url`, `og:image` (absolute, 1200x630, with width, height and alt), `twitter:card` = `summary_large_image`, and `website/public/og.png`.

## Context

- Source: issue #4. Reference setup: `../solid-optimizer/website/src/Document.tsx` builds absolute URLs from a `SITE_URL` constant. Find the deployed URL in `website/vercel.json` or the README; ask if not found.
- The redesign (website-redesign) will restyle the site later; keep the image simple, it can be redone then.

## Acceptance

- [ ] Built `dist/index.html` has every tag with absolute URLs; `og.png` is 1200x630.

## Sizing

S.
