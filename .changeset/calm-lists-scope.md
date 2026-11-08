---
'solid-sfc': patch
---

Fix CSS scoping of a selector list whose later selector starts with whitespace, as in `.a, .b` in SCSS and Less and `.a, ::before` in CSS, which put the attribute on a separate compound. Keyframe renaming no longer changes the unit of a time such as `1s` when a keyframe is named `s`.
