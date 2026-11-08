---
'solid-sfc': patch
---

Fix CSS minification of escapes outside strings: `.a\ ,.b`, `x\, y` and a value that ends in `\ ` keep their meaning, and `\"` no longer starts a string.
