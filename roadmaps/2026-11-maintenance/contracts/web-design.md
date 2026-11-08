---
name: web-design
version: 1
status: frozen
defined_by: website-redesign
---

# Contract: web-design

## Purpose

The visual direction and the CSS custom properties every page of the redesigned website uses. web-design-system implements the tokens and the shell; web-home, web-docs, web-playground and web-og-image build on them.

## Direction: "Source and output"

A `.solid` file is one document in three parts. The site is typeset like a printed technical monograph: an editorial, Swiss-style layout on a 12-column grid, wide margins, large display serif headlines against a quiet sans body, and small monospace labels in the margin (`<script>`, `<style>`, `markup`, `out.js`) that mark sections the way a block marks part of a file.

- **Signature element.** The three blocks of a `.solid` file have their own hue: script, style, markup. They appear as a 3px rule on the left of code blocks, as the color of margin labels, and as the three-band mark in the logo and favicon. Nothing else is colored except links and the accent.
- **Hairlines, not boxes.** Sections are divided by 1px hairlines and space. No drop shadows, no gradients, no rounded cards. Radius is 2px at most.
- **Typography.** Display: Instrument Serif (regular and italic) for h1 and h2 only, set large and tight (line-height 1.0 to 1.1, letter-spacing -0.01em). Body: Geist, 17px base, line-height 1.6. Mono: Geist Mono for code, labels, nav and numbers. Labels are mono, 12px, uppercase, letter-spacing 0.08em.
- **Motion.** Only where it explains: the hero source-to-output reveal, 150 ms color transitions. All motion off under `prefers-reduced-motion`.
- **Light and dark.** Paper and ink in light; warm near-black and bone in dark. Both meet WCAG AA for body text and for every label color on its background.
- **Fonts are self-hosted** woff2 files in `website/public/fonts/` with their OFL license files, loaded with `@font-face` and `font-display: swap`. No third-party requests.

## Interface

```css
:root {
  /* color, light */
  --paper: #f6f4ef;       /* page background */
  --surface: #efece4;     /* code blocks, panes */
  --ink: #14130f;         /* text */
  --muted: #6b675e;       /* secondary text */
  --hairline: #d9d4c7;    /* rules and borders */
  --accent: #2f3fd0;      /* links, primary action */
  --accent-ink: #ffffff;  /* text on accent */
  --script: #2f3fd0;      /* <script> block */
  --style: #c2410c;       /* <style> block */
  --markup: #0f766e;      /* markup */
  /* alerts keep their names: --note --tip --important --warning --caution */

  /* type */
  --font-display: 'Instrument Serif', 'Iowan Old Style', Georgia, serif;
  --font-body: 'Geist', system-ui, sans-serif;
  --font-mono: 'Geist Mono', ui-monospace, Menlo, monospace;
  --step--1: clamp(0.8rem, 0.78rem + 0.1vw, 0.875rem);
  --step-0: clamp(1rem, 0.96rem + 0.2vw, 1.0625rem);
  --step-1: clamp(1.25rem, 1.1rem + 0.6vw, 1.5rem);
  --step-2: clamp(1.6rem, 1.3rem + 1.4vw, 2.25rem);
  --step-3: clamp(2.2rem, 1.6rem + 2.8vw, 3.75rem);
  --step-4: clamp(3rem, 2rem + 5vw, 6.5rem);

  /* space and layout */
  --space-1: 0.25rem; --space-2: 0.5rem; --space-3: 0.75rem; --space-4: 1rem;
  --space-5: 1.5rem; --space-6: 2.5rem; --space-7: 4rem; --space-8: 7rem;
  --grid-max: 76rem;      /* content width */
  --gutter: clamp(1rem, 4vw, 3rem);
  --measure: 66ch;        /* prose width */
  --radius: 2px;
  --header-height: 3.5rem;
}
/* dark (prefers-color-scheme: dark):
   --paper #0e0e0c  --surface #171714  --ink #ece8df  --muted #9a958a  --hairline #2a2925
   --accent #8b96ff --accent-ink #0e0e0c --script #8b96ff --style #fb8a5c --markup #3cc4b4 */
```

Shared classes defined by web-design-system in the global style of `website/src/App.solid`:

- `.label`: mono margin label. Add `data-block="script|style|markup"` for the block hue.
- `.button`, `.button.primary`: mono, uppercase label text, 2px radius, 1px border.
- `.rule`: full-width hairline.
- `.grid`: 12-column grid inside `--grid-max` with `--gutter` side padding.
- `pre.twinkleplop`: code block on `--surface` with a 3px left rule; `data-block` picks its hue, default `--script`.

## Behavior

- Pages use only these tokens for color, type and spacing. New tokens go through a change request.
- The old names (`--background`, `--border`, `--text`, `--code-background`, `--font`, `--mono`) stay as aliases until every page has moved, then web-og-image (the last child) removes them.

## Changes

- v1: initial.
