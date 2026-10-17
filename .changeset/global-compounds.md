---
'solid-sfc': minor
---

When the last compound of a selector is `:global(...)`, as in `.content :global(p)`, the compound before it is scoped, so the rule only reaches into the elements of the file. Before, such a selector was not scoped at all. The compiler also runs in browsers now, where PostCSS makes no source maps.
