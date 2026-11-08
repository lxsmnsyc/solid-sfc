---
'solid-sfc': patch
---

Fix `const y = x++` on a `$signal`: a postfix update whose value is used now returns the old value, not the new one. An update used as a statement or a for-update keeps its short form.
