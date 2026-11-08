---
id: web-prerender
title: Server-render and prerender the website with start mode
status: todo
priority: should
type: feature
story: website-redesign
size: M
added: 2026-11-08
verify: pnpm --filter website build
owns:
  - website/index.html
  - website/preview.html
  - website/vite.config.ts
  - website/package.json
  - website/scripts/prerender.ts
  - website/src/main.ts
  - website/src/entry-server.ts
  - website/src/entry-client.ts
  - website/src/routes.ts
  - website/src/router.ts
  - website/src/Document.solid
  - website/src/App.solid
  - pnpm-lock.yaml
depends_on:
  - on: web-design-system
    kind: hard
    why: restructures the shell that web-design-system builds
---

# Server-render and prerender the website with start mode

## Goal

The website is a client-only SPA. Make it work like solid-optimizer's site: `solidSFC({ solid: { ssr: true, start: true } })` (check the option shape in `packages/solid-sfc/src/vite.ts` and `examples/ssr`), a server entry that renders each route, `scripts/prerender.ts` that writes every route to HTML at build time (home, playground, and one page per doc in `website/docs/`), and a client entry that hydrates. Each route gets its own `<title>`, description, canonical URL and Open Graph URL, built from `SITE_URL` (Vercel's `VERCEL_PROJECT_PRODUCTION_URL`, default `https://solid-sfc.vercel.app`), replacing the static tags from PR #8. The playground's compiler and the COI service worker stay client-only.

## Context

- Reference: `../solid-optimizer/website/` (`vite.config.ts`, `src/entry-server.tsx`, `src/entry-client.tsx`, `src/routes.ts`, `src/Document.tsx`, `scripts/prerender.ts`, `vercel.json` output `dist/client`). Read it, adapt it to `.solid` files.
- `examples/ssr` in this repo renders a `.solid` app with start mode and hydrates; use it as the solid-sfc side of the reference.
- Update `website/vercel.json` `outputDirectory` if the client build moves (minimal deviation; PR #14 adds an ignore step to the same file).
- Pages must be SSR-safe: no `window`, `document` or `localStorage` at module top level. The theme toggle must not flash: read the saved theme in an inline script in the document head.
- Docs routes: `/docs/` and `/docs/<page>/`; old hash or path forms keep working (redirect or same output).

## Acceptance

- [ ] `dist` has one prerendered HTML file per route with its content in the HTML (view source shows the docs text); the client hydrates without mismatch warnings in the console.
- [ ] Per-route title, description, canonical and `og:url`; `og:image` absolute.
- [ ] No theme flash on reload with the light theme saved.
- [ ] Playground compiles and previews as before; COOP/COEP still apply.
- [ ] Build and typecheck pass; `website/README.md` explains the build.

## Sizing

M: known pattern from solid-optimizer, new to this site.

## Notes for the worker

- Adding SSR dependencies (if any) edits `pnpm-lock.yaml`; no other node edits it while you run.
