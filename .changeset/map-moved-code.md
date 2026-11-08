---
'solid-sfc': patch
---

Fix source maps for code that the compiler moves. The body of an `$effect` callback that moves to module level had no mappings, so breakpoints and stack traces in it pointed nowhere. The parameters of `#for`, `#repeat` and `#catch` had no mappings either, so the editor could not map hover or go to definition on them.
