# Log: web-design-system

- 2026-11-08. Branch `feat/web-design-system` from `origin/feat/website-redesign` (1ca2128). `pnpm install && pnpm build` passed.
- Fonts from jsDelivr `@fontsource/{instrument-serif,geist,geist-mono}`: Instrument Serif 400 normal and italic, Geist 400/500/600, Geist Mono 400/500, latin woff2, plus each package's LICENSE (OFL 1.1). About 100 KB in total.
- Contrast check (scratchpad `contrast.mjs`): every text token passes 4.5:1 on paper and surface in both schemes except light `--style` on `--surface` (4.39). Used `#bd3f0b` (4.59) and wrote a change request.
- `@font-face` lives in `theme.css` (a real CSS file imported by main.ts). Checked that Vite rewrites `url('/fonts/...')` with `BASE=/x/` to `/x/fonts/...`.
- twinkleplop emits `<span class="label">` in highlighted code (markdown labels). The global `.label` class would turn those into uppercase mono labels, so `theme.css` resets `.twinkleplop .label`.
- Highlight theme: my own `:is()` rules grouped by hue, not the `--twp-*` variables. The GitHub theme package is no longer imported but stays in package.json (dependency nodes own it).
- Headless Chrome cannot go below about 500px wide; the 320px shots use a 320px iframe in a wrapper page.
- Playground fills the window (`height: calc(100vh - header)`), so the footer is hidden there and the header bar goes full width (`.bar.wide`, padding `--space-5`) to line up with the playground toolbar.
- The worktree guard refused writes to the main checkout's roadmap folder, so log, outcome and change request were written to the scratchpad for the orchestrator to copy.
- Build, typecheck, oxfmt pass. Commit a357295, draft PR #11.
