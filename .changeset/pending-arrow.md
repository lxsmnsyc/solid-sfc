---
'solid-sfc': minor
---

`$isPending` and `$latest` wrap their argument in a function, as `$untrack` and `$resolve` do, so `$isPending(quote)` works on a reactive variable. An argument that is already a function stays as it is.
