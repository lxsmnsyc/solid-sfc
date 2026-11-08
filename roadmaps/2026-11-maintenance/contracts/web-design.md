---
name: web-design
version: 5
status: frozen
defined_by: website-redesign
---

# Contract: web-design

## Purpose

The visual direction and shared interface of the redesigned website. v3 replaces the v1/v2 "Source and output" editorial direction, which the user rejected as too basic (2026-11-08). The bar: the user's other sites (solid-optimizer, atemno, compostate: dark, atmospheric, heavy display type, built around live demos). solid-sfc must match that family and go past it.

## Direction: "Unfold"

The site is a live demonstration that one `.solid` file unfolds into a Solid component. Everything that can be live is live.

1. **Atmosphere.** Dark first: near-black blue `--bg #070a12`, a large soft radial glow of Solid blue behind the hero, and a faint 32px grid that fades out at the edges. No noise layer. Light scheme supported and designed (paper `#f7f8fb`, same structure, glow at low opacity), never a plain inversion.
2. **Type.** Display: Geist 700 to 800, tight (`letter-spacing: -0.045em`, line-height 0.95), huge (hero up to 7rem). Headlines are solid `--text`: no gradient text. Body Geist 400. Mono Geist Mono for code, labels, numbers.
3. **The three block hues** are the brand: script `--script`, style `--style`, markup `--markup`. They mark every place a block appears: code rules, scene layers, demo labels, the logo.
4. **Signature scene: the unfolding file.** Below the hero, a `.solid` file card sits in 3D perspective. As the user scrolls, its script, style and markup blocks lift apart into three layers (CSS 3D transforms, scroll-driven animation with an IntersectionObserver fallback), and animated connectors draw from each layer to what it becomes: the component function, the scoped CSS (with the hashed attribute visible), and the DOM it renders. All outputs are compiled at build time from the real compiler, never hand-written. Under `prefers-reduced-motion` it shows the final unfolded state.
5. **Live hero.** The hero holds an editable `.solid` snippet with a live preview next to it. The compiler (wasm, already used by the playground) loads lazily on first focus or idle, compiles in a worker, and shows "compiled in N ms · N B". Before it loads, the preview shows the build-time render, so the page is complete without JS.
6. **Live feature demos**, each a small interactive component with its source and the compiled line that matters highlighted: `$signal` counter (shows the setter call), `#for` with keys (add, remove, reorder), scoped styles (toggle shows the attribute selector), `#loading` with a fake fetch.
7. **Build-time numbers band**: compile time and output size of the example components, measured when the site builds.
8. **Detail.** Panels are flat: `.raised` (`--bg-raised`, 1px `--border`, `--radius`), with one treatment per element (no border, shadow and tint together). Only the sticky header uses `backdrop-filter`. One shadow on the page, on its single floating object (the hero window). The primary button is a flat accent fill with no glow. Icons come from `ui/Icon.solid` (1.5 stroke, sizes 16 and 20); icon-only buttons have an `aria-label` and a tooltip. Copy buttons, keyboard shortcut hints, `cmd-K` docs search.
9. **Motion.** Only in response to the user or a state they changed: nothing animates on first paint or while idle. Animate `transform` and `opacity` only. Entrances `--enter` (200ms) with `--ease-out`, exits `--exit` (150ms) with `--ease-in`. Hovers change color at once; presses scale to 0.97. Script-driven transitions must reverse from any point (CSS transitions on a state class). Scroll-driven transforms (the hero window, the unfolding file) are allowed.

## Interface

```css
:root { /* dark, default */
  --bg: #070a12; --bg-raised: #0c111c; --panel: rgb(255 255 255 / 0.03);
  --border: rgb(255 255 255 / 0.08); --border-strong: rgb(255 255 255 / 0.16);
  --text: #e8edf6; --muted: #8a95a8; --faint: #4b5567;
  --accent: #5b8def; --accent-strong: #7ea6ff; --accent-ink: #050810;
  --glow: rgb(68 107 158 / 0.45);
  --script: #7ea6ff; --style: #ff8f6b; --markup: #4fe0b8;
  --note: #7ea6ff; --tip: #4fe0b8; --important: #c9a2ff; --warning: #f2c14e; --caution: #ff7a7a;
  --font-display: 'Geist', system-ui, sans-serif;
  --font-body: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, monospace;
  --radius: 12px; --radius-sm: 8px; --radius-xs: 4px; /* nested corners: inner = outer - padding */
  --grid-max: 80rem; --gutter: clamp(1rem, 4vw, 2.5rem); --measure: 68ch;
  --header-height: 3.75rem;
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1); --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --enter: 200ms; --exit: 150ms; --ease: var(--ease-out);
}
/* light: --bg #f7f8fb --bg-raised #ffffff --panel rgb(10 20 40 / 0.03) --border rgb(10 20 40 / 0.08)
   --border-strong rgb(10 20 40 / 0.16) --text #0b1220 --muted #556072 --faint #9aa3b2
   --accent #2f5fd0 --accent-strong #1f4cb8 --accent-ink #ffffff --glow rgb(47 95 208 / 0.18)
   --script #2f5fd0 --style #c2410c (use #bd3f0b on panels if under 4.5:1) --markup #0f766e */
```

Fluid type steps `--step--1` to `--step-6` and spacing `--space-1` to `--space-9` are defined by web-design-system and documented in its outcome.

Shared building blocks (web-design-system, global styles and `website/src/ui/*.solid`):

- `.raised` panel, `.button` / `.button.primary`, `.kbd`, `.label` (mono, uppercase, `data-block="script|style|markup"` for hue), `.grid`.
- `<Icon name size>`, `<CopyButton>` (copied and failed states, fixed width), `<CodeBlock>` with copy button and optional highlighted lines, `<CopyCommand>` (install line with package manager tabs: npm, pnpm, yarn, bun).
- Atmosphere layer (glow, grid) in the shell, toggled per page.

## Behavior

- Home initial JS stays small: no compiler or wasm until the user focuses the hero editor or the browser is idle. Lighthouse performance 95+ on home.
- Every live demo works with keyboard and has a static fallback.
- WCAG AA contrast for all text in both schemes.
- Visible `:focus-visible` ring everywhere; hit targets 44px on coarse pointers; Esc closes overlays.
- Replacing user content (such as loading an example over edits) offers undo.
- Pages use only these tokens. New tokens go through a change request.

## Changes

- v1: "Source and output", editorial. v2: contrast fix.
- v3: "Unfold", dark-first, atmospheric, live. Replaces v1/v2 entirely, 2026-11-08, after user feedback.
- v4: adds `--glass`, `--sheen`, `--sheen-strong`, `--shadow`, `--grid-line`; light alert values; dark is the default theme with a saved toggle. Values in web-design-system's outcome. From `reviews/web-design-cr-2-accepted.md`.
- v5: applies the user's UI style rules (PR #26, 2026-11-08). Removes gradient text, glass panels (`.glass`, `--glass`, `--sheen`, `--sheen-strong`), noise, glows on controls, and first-paint and idle animation. Adds `.raised`, `--radius-xs`, `--ease-out`, `--ease-in`, `--enter`, `--exit`, `ui/Icon.solid`, and the motion and access rules above.
