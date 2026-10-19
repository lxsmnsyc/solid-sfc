---
'solid-sfc': minor
'@solid-sfc/language-core': minor
'solid-sfc-vscode': minor
---

Add dynamic tags. `<{tag} a=b>children</>` renders a component from `dynamic(() => tag)`, where the tag can be any expression. A dynamic tag gets the scope attribute and the style variables, matches every tag selector when looking for unused selectors, and gets no accessibility warnings. Typing `>` after a dynamic tag in the editor inserts `</>`.
