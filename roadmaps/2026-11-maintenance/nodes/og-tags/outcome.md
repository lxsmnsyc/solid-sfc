# Outcome: og-tags

## Built

- `website/index.html` and `website/preview.html`: description (added to preview), canonical, og:type, og:site_name, og:title, og:description, og:url, og:image (absolute) with width, height and alt, and twitter:card summary_large_image. All URLs are absolute on https://solid-sfc.vercel.app.
- `website/public/og.png`: 1200x630, 49 KB, plain dark card with the name and tagline.
- PR #8, closes #4.

## Proof

Not a fix node.

## Deviations

- Tags are static HTML, not injected from a SITE_URL constant. `vite.config.ts` is unchanged.
- The canonical URL is the site root on every page, since an SPA can have only one in static HTML.

## Stubs left

- og.png is simple; website-redesign can replace it (same path and size).

## Gotchas

- If the deployed domain changes, update the URLs in both HTML files.
- og.png was made with qlmanage and sips from an SVG that is not kept in the repo.

## Proposed learnings

- None.

## Verification

- `pnpm install && pnpm build`: pass.
- `pnpm --filter website build`: pass; dist/index.html has every tag, dist/og.png present.
- `pnpm --filter website typecheck`: pass. `./node_modules/.bin/oxfmt --check`: pass.

## Size

- Estimated S, actual S.
