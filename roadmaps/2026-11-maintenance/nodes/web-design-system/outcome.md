# Outcome: web-design-system

## Built

Branch `feat/web-design-system`, commits 1d697dc and 290de95 on top of a357295 (v1), draft PR #11 against `feat/website-redesign`. Implements contract `web-design` v3 ("Unfold").

### Files

- `website/src/App.solid`: global style (tokens, aliases, base elements, shared classes), atmosphere layer, header, footer, skip link, theme toggle.
- `website/src/theme.css`: `@font-face` for 7 files, and the highlight theme.
- `website/src/main.ts`: sets `data-theme` from `localStorage.theme` (default dark) before render.
- `website/src/router.ts`: same-page hash links are left to the browser (skip link and table of contents links now move focus natively).
- `website/public/fonts/`: `geist-latin-{400,500,600,700,800}-normal.woff2`, `geist-mono-latin-{400,500}-normal.woff2`, `Geist-OFL.txt`, `GeistMono-OFL.txt`.
- `website/public/favicon.svg`: layered mark with light and dark colors.
- `website/src/ui/`: `Logo.solid`, `CopyButton.solid`, `CopyCommand.solid`, `CodeBlock.solid`, `HeroPreview.solid`, `hero/Counter.solid`, `hero/counter.md`.
- `website/src/home/Hero.solid` (renders `HeroPreview`), `website/src/home/Unfold.solid` (empty `<section class="unfold">`). `pages/Home.solid` now renders `<Hero />`, `<Unfold />`, then its old feature grid; the old hero and its CSS are gone.

### Tokens

All contract v3 colors, each as `light-dark(light, dark)`. `:root` has `color-scheme: dark`; `:root[data-theme='light']` sets `color-scheme: light`. Never branch on `prefers-color-scheme` in pages: use the tokens, or `:global([data-theme='light'])` for the rare non-color difference.

Added (change request): `--glass`, `--sheen`, `--sheen-strong`, `--shadow`, `--grid-line`, and light alert values.

Type steps (fluid, 390px to 1440px):

| Token      | Range               | Use                                 |
| ---------- | ------------------- | ----------------------------------- |
| `--step--1` | 0.8125 to 0.875rem | small text, footer, captions        |
| `--step-0` | 1 to 1.0625rem      | body                                |
| `--step-1` | 1.125 to 1.3125rem  | h3, lede                            |
| `--step-2` | 1.375 to 1.875rem   | large card titles                   |
| `--step-3` | 1.75 to 2.75rem     | h2 default (docs headings)          |
| `--step-4` | 2.25 to 4rem        | home section headings               |
| `--step-5` | 2.5 to 5.5rem       | h1 default                          |
| `--step-6` | 3.25 to 7rem        | hero headline only                  |

Space: `--space-1` 0.25rem, `-2` 0.5, `-3` 0.75, `-4` 1, `-5` 1.5, `-6` 2, `-7` 3, `-8` clamp(3.5rem to 5rem), `-9` clamp(5rem to 9rem). Use `-8` between blocks inside a section, `-9` between home sections.

Also: `--radius` 12px (panels), `--radius-sm` 8px (buttons, nav pills, inputs), `--grid-max` 80rem, `--gutter`, `--measure` 68ch, `--header-height` 3.75rem (the header, border included, is exactly this tall), `--ease`.

Old names aliased until web-og-image: `--background` (bg), `--surface` (bg-raised), `--code-background` (bg-raised), `--accent-text` (accent-ink), `--font`, `--mono`. `--border`, `--text`, `--muted`, `--accent` are v3 names now, with v3 values.

### Global elements

- `body`: Geist 400, `--step-0`, line-height 1.6, `--text` on `--bg`, antialiased.
- `h1` 800, `--step-5`, line-height 0.95, -0.045em. `h2` 700, `--step-3`, 1.1, -0.035em. `h3` 600, `--step-1`. `h4` 600, `--step-0`. All `margin: 0`, balanced. Set the size locally for section headings (`--step-4`).
- `strong, b`: 600. `a`: `--accent-strong`, underline at 40% that turns solid on hover. `:focus-visible`: 2px `--accent-strong` outline, offset 2px.
- Inline `code`: mono 0.875em, 1px `--border`, 6px radius, `--panel`. Reset it (`padding: 0; border: 0; background: none`) where code sits inside a styled line.
- `pre.twinkleplop`: `--bg-raised`, 1px border, 12px radius, 0.8125rem, line-height 1.7. Inside `CodeBlock` it is reset.
- `prefers-reduced-motion`: every transition and animation is cut to 0.01ms. Animations with a delay or a scroll timeline must also set `animation: none` under reduced motion (HeroPreview does).

### Shared classes

- `.glass`: `--glass` background, 1px `--border`, `--radius`, inner `--sheen` top edge, soft `--shadow`, `backdrop-filter: blur(16px) saturate(150%)`. Add `overflow: hidden` if children have backgrounds.
- `.button`: 2.75rem tall, Geist 500 0.9375rem, `--radius-sm`, `--panel` background, `--border-strong` border. `.button.primary`: `--accent` fill, `--accent-ink` text, glow shadow from the accent, `--accent-strong` on hover. An `svg.arrow` inside slides 3px on hover.
- `.kbd`: key cap for shortcuts, such as `<kbd class="kbd">⌘</kbd><kbd class="kbd">K</kbd>`.
- `.label`: Geist Mono 500 0.75rem, uppercase, 0.08em, `--muted`, `inline-flex`. `data-block="script|style|markup"` colors it and adds a small glowing square before it. Write the text as it reads (`&lt;script&gt;`); the class uppercases it.
- `.gradient-text`: the three hues in oklch (markup, script, style). Put it on an inline span inside a heading. For a glow, add `filter: drop-shadow(0 10px 48px color-mix(in srgb, var(--script) 35%, transparent))` locally.
- `.grid`: 12 columns, gap `--space-5`, max `--grid-max` plus gutters, centered. Collapse spans locally below 48rem.
- `.visually-hidden`.

### UI components (`website/src/ui/`)

- `<CodeBlock html=page.html title="Counter.solid" highlight=[3, 4] blocks=ranges copy=false>`: `html` is the HTML of a `.md` import that holds one fenced code block. `title` adds a head bar with the copy button; without it the copy button floats top right on hover. `highlight` tints lines (from 1). `blocks` is `BlockRange[]` (`{ block, from, to, label? }`, exported from `CodeBlock.solid`'s module script): each range gets a 2px rail and tint in its hue and a margin label (`<script>`, `<style>`, `markup` by default; hidden when the block is narrower than 34rem). The line math assumes the default code size; change `--code-size` and `--pad` on the figure if needed, never the `pre` line-height.
- `<CopyCommand packages="solid-sfc" dev>`: glass box with npm, pnpm, yarn, bun tabs (arrow keys, Home, End) and a copy button. The chosen manager is shared by every instance and saved in `localStorage['package-manager']`.
- `<CopyButton text=(() => value) label="Copy …">`: small button that shows "Copied" for 1.6s and announces it.
- `<Logo size=20>`: the layered mark, in the block hues.
- `HeroPreview`: the hero prototype (see below).

To get build-time highlighted HTML for a sample, put it in a `.md` file in a fenced ` ```html ` block (the `.solid` language) and import it; the markdown plugin returns `{ html }`.

### Shell

- Atmosphere: an absolutely placed layer behind the page with the `--glow` radial (centered 12rem down), two faint style and markup glows, the 32px grid masked to fade out, and noise. Full on home (76rem tall), `.docs` variant on docs (34rem, 55% opacity), none on playground. Pages must not set an opaque background on full-width wrappers, or they hide it.
- Header: sticky glass, exactly `--header-height`. Logo and wordmark, version badge (`v` + `packages/solid-sfc/package.json` version, links to releases), nav (Docs, Playground; active page has `aria-current="page"` and a pill), GitHub icon, theme toggle. Below 40rem the badge hides; below 26rem the wordmark text is visually hidden. On `/playground` the bar spans the window.
- Footer (home and docs): brand and one-line description, Docs and Project link columns, a fine-print row. `margin-top: var(--space-8)`.
- Skip link to `#content` (the page wrapper, `tabindex="-1"`).

### Hero prototype

`HeroPreview.solid`: pill (1.0 · rebuilt for SolidJS 2.0, links to migration), "One file." / "Three blocks." (gradient with glow), lede, Get started and Open the playground, `CopyCommand`, then a glass window in 3D perspective that settles flat on scroll (`animation-timeline: view()`, static where unsupported). The window holds `Counter.solid` source with block bands, an arrow on the seam, a live preview of the real component, and a DOM view that updates on each click and underlines the scope attribute. A row of bundler names follows. The intro rises in with a 70ms stagger. web-hero replaces the static source with the live editor and compiler.

## Deviations

- Tokens added and light alerts chosen; dark is the default regardless of system preference (see change request).
- Hero sample source is kept twice (`hero/Counter.solid` and `hero/counter.md`); they must stay identical. web-hero should replace this with compiling the snippet.
- `Home.solid` edited (allowed by the brief): imports the stubs, drops the old hero.
- Search (`cmd-K`) not built; left to web-docs.

## Stubs left

- `home/Hero.solid` renders `HeroPreview`; web-hero replaces it.
- `home/Unfold.solid` is an empty section; web-unfold fills it.
- Old token aliases remain for web-og-image to remove.
- `@twinkleplop/theme-github` still in `website/package.json`, unused.

## Gotchas

- `light-dark()` only works on colors. Non-color differences need `:global([data-theme='light'])`.
- twinkleplop emits `<span class="label">` in code; `theme.css` resets `.twinkleplop .label` (font, case and the `::before` square).
- Saved light theme flashes dark until main.ts runs (index.html not owned).
- `class={ name }` object shorthand works for conditional classes; boolean `aria-*` attributes need `'true'`/`'false'` strings to typecheck; use `tabindex`, not `tabIndex`.
- The solid highlighter colors a CSS property that holds `${}` in the style hue, unlike other properties.
- Page `<main>` max widths still come from the old pages.

## Proposed learnings

- Use `light-dark()` tokens with `color-scheme` on the root for themes | one definition per color, toggle by attribute | website/src | no
- Leave same-page hash links to the browser in the router | a prevented jump does not move focus | website/src/router.ts | yes (e2e)

## Verification

- `pnpm --filter website build`: pass (main JS 296 kB, 46 kB gzip; CSS 2.6 kB).
- `pnpm --filter website typecheck`: pass. `./node_modules/.bin/oxfmt --check`: pass. `./node_modules/.bin/oxlint`: pass.
- CDP checks: playground scrollHeight 900 at innerHeight 900; Tab, Enter on the skip link focuses `#content`, next Tab stays inside it; no horizontal overflow at 1440 or 390.
- Contrast (WCAG): dark text 16.1 to 16.8, muted 6.2 to 6.5, accent-strong 7.9 to 8.3, script 7.9, style 8.4, markup 11.4, alerts 7.5 to 11.8, accent-ink on accent 6.2. Light text 16.6 to 18.7, muted 5.6 to 6.4, accent 5.1 to 5.7, style 4.59 to 5.18 (4.5+ on 8% code bands), markup 4.85 to 5.47, alerts 5.0+, white on accent 5.72. `--faint` (2.4 to 2.6) is never used for text. Focus ring `--accent-strong` is 6.7+ on every ground.
- Lighthouse not run in this node.
- Screenshots in `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-solid-sfc/00831d19-3175-471f-924a-e40fb5a85545/scratchpad/web-design-system/v3/`:
  - `{home,docs,playground}-{dark,light}-{1440,390}.png` (viewport)
  - `{home,docs,playground}-{dark,light}-{1440,390}-full.png` (full page; the hero window appears tilted because full-page capture does not scroll the timeline)
  - `home-{dark,light}-{1440,390}-scrolled.png` (hero window in view after six clicks: crimson button, `#if` paragraph, `class="hot"` in the DOM view)

## Size

- Estimated M, actual L. The v3 rework replaced v1 entirely and added the UI components and the hero prototype.
