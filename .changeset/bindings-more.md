---
'solid-sfc': minor
---

Add `bind:group` for radio buttons and checkboxes, `bind:open` for `<details>` and `<dialog>`, `bind:files` for file inputs, and `bind:value` on `<select multiple>`, which reads an array. Assignments whose value is in parentheses, as in `count = (next)`, no longer leave a `)` behind in the compiled setter call.
