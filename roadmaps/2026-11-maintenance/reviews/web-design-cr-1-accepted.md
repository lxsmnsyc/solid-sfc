# Change request: web-design v1

Filed by web-design-system, 2026-11-08.

## Problem

Light `--style: #c2410c` is 4.39:1 on `--surface: #efece4`. Code tokens in the style hue (numbers, types, selectors, attributes) sit on `--surface` in every code block, so they fail WCAG AA (4.5:1). On `--paper` it is 4.71:1 and passes.

## Proposed change

Light `--style: #bd3f0b`. It is 4.59:1 on `--surface` and 4.92:1 on `--paper`, the closest value to the original that passes. Dark `--style` is unchanged (7.61:1 on dark `--surface`).

## Local adaptation

web-design-system ships `#bd3f0b` in `website/src/App.solid` and `website/public/favicon.svg` (PR #11).

## Also added (not in the contract interface)

- Alert colors, named as the contract says (`--note --tip --important --warning --caution`), with values that pass 4.5:1 on paper and surface in both schemes. Light: `#2f3fd0 #0f766e #7a3fc0 #8a5a00 #b42318`. Dark: `#8b96ff #3cc4b4 #c59bff #e0a63a #ff7a6b`.
- Alias `--accent-text: var(--accent-ink)`. The current pages use the old name `--accent-text`, which the contract's alias list leaves out.
