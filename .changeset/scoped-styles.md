---
'solid-sfc': minor
---

Scoped styles no longer depend on `solid-styled`.
`<style>` blocks now compile to a CSS file that Vite bundles, so no styles are added at runtime.
Interpolations joined with other text, such as `${size}px`, produce valid CSS.
Remove `solid-styled` from your dependencies, and move `solid-sfc` to `dependencies` because components import `solid-sfc/runtime`.
