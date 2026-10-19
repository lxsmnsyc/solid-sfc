---
'solid-sfc': minor
---

`$refresh(quote)` passes the accessor of a reactive variable, as Solid's `refresh` needs, instead of its value, which threw at runtime. In an `$effect`, it does not make the effect track the variable.
