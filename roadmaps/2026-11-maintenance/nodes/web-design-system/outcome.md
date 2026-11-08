# Outcome: web-design-system

## Built

Branch `feat/web-design-system`, commit a357295, draft PR #11 against `feat/website-redesign`.

- `website/src/App.solid`, global style: every token of `contracts/web-design.md` for light and dark, the alert colors, the old-name aliases, base element styles, the shared classes. Scoped style and markup: skip link, header, footer.
- `website/src/theme.css`: `@font-face` for the seven font files, and the code highlight theme. The GitHub theme imports are gone.
- `website/public/fonts/`: `instrument-serif-latin-400-{normal,italic}.woff2`, `geist-latin-{400,500,600}-normal.woff2`, `geist-mono-latin-{400,500}-normal.woff2`, `InstrumentSerif-OFL.txt`, `Geist-OFL.txt`, `GeistMono-OFL.txt`.
- `website/public/favicon.svg`: the three-band block mark (script, style, markup bars of widths 14, 9 and 11.5 on a 16 grid), with dark-scheme colors.
- `website/src/main.ts`: unchanged.

### What pages get for free (global style)

- `body`: `--font-body`, `--step-0`, line-height 1.6, `--ink` on `--paper`. Dark scheme turns on grayscale font smoothing.
- `h1`: display serif, `--step-3`, line-height 1. `h2`: display serif, `--step-2`, line-height 1.1. Both weight 400, letter-spacing -0.01em, `margin: 0`, balanced wrap. A hero h1 sets `font-size: var(--step-4)` itself.
- `h3`, `h4`: body font, 600, line-height 1.3, `--step-1` and `--step-0`, `margin: 0`.
- `a`: `--accent`, 1px underline at 0.2em offset, turns `--ink` on hover, 150 ms color transition. Remove the underline in your own style where the layout already marks a link (nav lists).
- `:focus-visible`: 2px `--accent` outline, offset 2px, on every element. Do not remove outlines; if a control clips it, give it room.
- Inline `code` (not in `pre`): mono, 0.875em, `--surface` background, 2px radius.
- `hr`: a hairline with no margin.
- `::selection`: `--accent-ink` on `--accent`.
- `prefers-reduced-motion: reduce` sets every transition and animation to 0.01ms. Pages add no extra guard for CSS motion; JS-driven motion (the hero reveal) must check `matchMedia('(prefers-reduced-motion: reduce)')` itself.

### Shared classes

- `.label`: mono, 12px (0.75rem), weight 500, uppercase, letter-spacing 0.08em, `--muted`, `display: block`, line-height 1.6, tabular numbers. Add `data-block="script"`, `"style"` or `"markup"` for the block hue. Write the text as it reads, such as `<span class="label" data-block="script">&lt;script&gt;</span>` or `<span class="label">out.js</span>`; the class uppercases it. Set `display: inline` locally if you need it inline.
- Margin label layout: put the label in the margin columns and the content beside it in one `.grid` row with `align-items: baseline`, so the label sits on the first line of the content (heading or paragraph). Example: label `grid-column: 1 / 3`, content `grid-column: 3 / -1`; below 48rem both `1 / -1` and the label goes above with `margin-bottom: var(--space-2)`.
- `.button`: inline-flex, min-height 2.75rem (44px target), padding 0 `--space-5`, 1px `--ink` border, 2px radius, mono 12px uppercase 0.08em, `--ink` text on transparent. Hover inverts to `--paper` on `--ink`. `.button.primary`: `--accent-ink` on `--accent`; hover goes to `--paper` on `--ink`. Works on `<a>` and `<button>`. Put an icon or arrow inside; the gap is `--space-2`.
- `.rule`: full-width 1px `--hairline`, no margin. Use on `<hr>` or a `<div>`; add margins locally.
- `.grid`: `display: grid`, 12 equal columns, column gap `--space-5`, `max-width: calc(var(--grid-max) + 2 * var(--gutter))`, centered, `padding-inline: var(--gutter)`. No row gap; set `row-gap` locally. Place children with `grid-column`. The grid stays 12 columns at every width; collapse spans to `1 / -1` in your own media query (48rem is the shell's breakpoint). For prose, cap width with `max-width: var(--measure)`. To run a full-bleed band (hairline or surface) with grid content, wrap: `<section class="band"><div class="grid">…</div></section>`.
- `pre.twinkleplop`: `--surface` background, 3px left rule, radius 0 2px 2px 0, padding `--space-4` `--space-5`, mono 0.875rem, line-height 1.65, tab size 2, margin `--space-5` 0, horizontal scroll with a thin hairline scrollbar. `data-block="style"` or `"markup"` on the `pre` picks the rule hue; default script. The rule color is the local custom property `--block`, so a wrapper can also set `--block: var(--markup)`.
- `.visually-hidden`: hides text but keeps it for screen readers.

### Highlight theme

Token colors come from the block hues and follow the scheme with the page:

- `--script`: keywords, directives, `#if`/`#for` blocks, decorators, builtins, markdown headings and links.
- `--style`: numbers, booleans, constants, types, class names, CSS selectors, attribute names, CSS variables.
- `--markup`: strings, templates, regexes, tag names, markdown code.
- `--muted`: comments, punctuation, operators, markers.
- `--ink`: identifiers and everything else. Function names are weight 500.

### Shell

- Skip link "Skip to content", visible on focus, targets `#content`, a wrapper around the page (`tabindex="-1"`, no outline). Pages render inside it; keep your own `<main>`.
- Header: sticky, `--paper`, hairline under it, height `--header-height`. Inner bar is aligned to the grid width (same max-width and gutter as `.grid`). Left: block mark and wordmark "solid-sfc" (Geist 600); below 26rem only the mark shows (the name stays for screen readers). Right: Docs, Playground, GitHub↗ in mono 12px uppercase, `--muted`, hover `--ink`. Active page has `aria-current="page"`: `--ink` text and a 1px `--ink` underline that sits on the header hairline.
- On `/playground` the bar goes full width with `--space-5` padding to line up with the playground toolbar, and the footer is not rendered (the playground fills the window).
- Footer (home and docs): `margin-top: var(--space-8)`, hairline on top, `.grid` row: block mark and colophon line in columns 1-7 ("solid-sfc. Single-file components for SolidJS 2.0. MIT License.", `--step--1`, `--muted`), links Docs, npm↗, GitHub↗ in columns 8-12. Pages should not add their own large bottom padding on top of it.
- Playground loading state: `<p class="loading label">Loading the compiler…</p>`, grid-aligned.

## Deviations

- Light `--style` is `#bd3f0b`, not `#c2410c` (4.39:1 on `--surface`, fails AA). Change request: `contracts/web-design.change-request.md`.
- Added the alert colors (contract only names them) and the alias `--accent-text: var(--accent-ink)` (used by current pages, missing from the contract's alias list). Both in the change request.
- `@font-face` is in `theme.css`, not in App.solid, because Vite rebases its `url()` with `BASE` reliably there.
- Footer hidden on the playground.

## Stubs left

- Old aliases (`--background --border --text --code-background --accent-text --font --mono`) remain; web-og-image removes them after the pages move.
- `@twinkleplop/theme-github` is no longer imported but is still in `website/package.json`. A dependency node can drop it.
- The pages (Home, Docs, Playground) are not restyled; they inherit fonts, colors and the global h1/h2 serif. Home's feature cards still have rounded borders from its own style.

## Gotchas

- twinkleplop emits `<span class="label">` inside highlighted code. `theme.css` resets `.twinkleplop .label` so the global `.label` does not apply there. Do not use `.label` styles with higher specificity that would leak into code.
- Global `h1`/`h2` are serif and `margin: 0`. Existing page styles that relied on the browser default margins lose them; set margins locally.
- The header's active mark uses `margin-bottom: -1px` on nav links; do not put `overflow: hidden` on the header.
- Headless Chrome screenshots have a minimum width near 500px; for 320px checks load the page in a 320px iframe.
- Fonts are not preloaded (index.html belongs to og-tags). With `font-display: swap` the first paint uses the fallbacks.

## Proposed learnings

- Highlight class names from twinkleplop (`label`, `tag`, `string`, `code`, ...) share names with site classes; scope site classes or reset them under `.twinkleplop` | a site `.label` restyled code spans | website/src | no

## Verification

- `pnpm --filter website build`: pass.
- `pnpm --filter website typecheck`: pass.
- `./node_modules/.bin/oxfmt --check`: pass.
- `BASE=/x/ vite build`: font URLs become `/x/fonts/...`.
- Contrast (WCAG): light ink/paper 16.91, muted/paper 5.13, muted/surface 4.77, accent/paper 6.97, accent-ink/accent 7.66, style/surface 4.59, markup/surface 4.64, alerts 4.64 to 6.97. Dark ink/paper 15.80, muted/surface 6.02, accent/surface 6.76, accent-ink/accent 7.27, style/surface 7.61, markup/surface 8.34, alerts 6.76 to 8.97. Focus ring (accent) on paper above 6.9 in both.
- Screenshots in `/private/tmp/claude-501/-Users-alexis-Documents-GitHub-solid-sfc/00831d19-3175-471f-924a-e40fb5a85545/scratchpad/web-design-system/`: `{home,docs,playground}-{light,dark}.png` (1440x900), `{home,docs,playground}-{light,dark}-full.png` (1440x2000, footer visible on home and docs), `{home,docs,playground}-{light,dark}-320.png` (320px iframe).

## Size

- Estimated M, actual M.
