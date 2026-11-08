# Change request: web-design v3

Filed by web-design-system, 2026-11-08. Replaces the v1 request (light `--style`), which v2 settled.

## 1. Tokens added for glass and atmosphere

The contract's detail section asks for glass panels, a soft glow on the primary button, a faint grid and a top sheen, but has no token for them. web-design-system added these in the global style of `App.solid`:

| Token            | Light                     | Dark                       | Use                                         |
| ---------------- | ------------------------- | -------------------------- | ------------------------------------------- |
| `--glass`        | `rgb(255 255 255 / 0.7)`  | `rgb(12 17 28 / 0.6)`      | Background of `.glass` panels               |
| `--sheen`        | `rgb(255 255 255 / 0.9)`  | `rgb(255 255 255 / 0.06)`  | 1px inner top edge of glass panels          |
| `--sheen-strong` | `rgb(255 255 255 / 0.25)` | same                       | Inner top edge on filled buttons            |
| `--shadow`       | `rgb(16 24 40 / 0.12)`    | `rgb(0 0 0 / 0.55)`        | Drop shadow under panels                    |
| `--grid-line`    | `rgb(10 20 40 / 0.055)`   | `rgb(255 255 255 / 0.04)`  | 32px atmosphere grid, dotted preview canvas |

Proposal: add them to the interface as written.

## 2. Light values for alerts

The contract lists dark alert colors only. Light values used (all 5.0:1 or more on bg, raised and panel): `--note #2f5fd0`, `--tip #0f766e`, `--important #7a3fc0`, `--warning #8a5a00`, `--caution #b42318`.

## 3. Theme default

"Dark, default" is implemented literally: without a saved choice the site is dark, whatever the system prefers. `main.ts` sets `data-theme` before rendering. Because `index.html` is not owned by this node, a visitor who saved "light" sees a dark frame before the module script runs. Proposal: once og-tags merges, a later node adds a 3-line inline script in `index.html` that sets `data-theme` from `localStorage` before the first paint.

## Not needed

Light `--style #c2410c` passes on every surface the site uses (4.59 on panel, 5.18 on raised). Code block bands are tinted at 8% so it stays at 4.5:1 or more on them.
