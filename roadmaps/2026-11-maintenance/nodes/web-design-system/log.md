# Log: web-design-system

## v1/v2 (superseded)

- 2026-11-08. Branch `feat/web-design-system` from `origin/feat/website-redesign` (1ca2128). Built the editorial "Source and output" shell, commit a357295, draft PR #11. The user rejected that direction as too basic.

## v3 rework ("Unfold")

- Read contract v3, the new brief, the PR #11 review and the reference shots (solid-optimizer, atemno, compostate). Those sites share a dark navy base, a radial glow behind a centered 800-weight headline with one gradient line, a pill above it, two buttons, a tabbed install box and a glass demo panel below.
- Fonts: removed Instrument Serif; added Geist 700 and 800 (jsDelivr `@fontsource/geist`). Kept Geist 400/500/600 and Geist Mono 400/500, all in use.
- Tokens use `light-dark()` so each color is written once. `:root` has `color-scheme: dark`; `[data-theme='light']` switches it. main.ts reads `localStorage.theme`.
- Contrast script (scratchpad `contrast.mjs`): every text token passes 4.5:1 on bg, raised and panel in both schemes. `--faint` is 2.4 to 2.6, so it is only used for decoration (borders, the pill arrow). Light `--style` on the code band at 10% was 4.48; lowered the band tint to 8%. The scope chip at 14% style tint was 3.98; changed it to an underline.
- Gradient words: first tried script, markup, style in oklch; mint to coral passed through olive. Order markup, script, style gives mint, blue, violet, coral, which reads as one gradient and keeps all three hues.
- Hero sample: a real `.solid` file (`ui/hero/Counter.solid`) rendered live in the preview, and the same source in `ui/hero/counter.md` for build-time highlighting through the markdown plugin. The DOM view watches the preview with a MutationObserver and colors the scope attribute, which shows scoping and `${}` variables live.
- Rewrote the sample for contracts/solid-idioms.md (coordinator message): `$memo` and `#if` instead of a ternary, `class={ hot }`.
- Review fixes: header height on `header` itself (scrollHeight 900 at 900); router skips same-page hash links, so the native jump moves focus (Tab, Enter, Tab lands inside `#content`). `.name` copy removed; `strong` is 600.
- Screenshots via a small CDP script (scratchpad `shoot.mjs`): headless Chrome cannot set localStorage per run otherwise, and old-style `--screenshot` cannot go below 500px.
- 390px code blocks: the block labels covered long lines; a container query hides them under 34rem.
- Checks: build, typecheck, oxfmt, oxlint pass. Commits 1d697dc and 290de95, pushed to PR #11 (still draft).
- Review 5816013686: the toggle applied the old theme (batched signal write read back in the same handler); fixed with a local `next`, checked with real clicks. The `settle` keyframe faded opacity from 0.85, which put resting hero code under AA; now transform only. Light `--style` set to `#bd3f0b` (4.49 on glass with `#c2410c`). DOM view `aria-hidden`. Commit 0990a97. The reviewer's server on port 4317 belongs to another session, so the toggle script was run against a copy pointed at port 5391.
- My earlier screenshots set the theme through localStorage, so they never exercised the toggle; that is how the bug got through.
- The worktree guard refuses writes to the main checkout, so log, outcome and change request are in the scratchpad.
