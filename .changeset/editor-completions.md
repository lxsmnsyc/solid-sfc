---
'@solid-sfc/language-core': minor
'@solid-sfc/language-server': minor
'solid-sfc-vscode': minor
---

Add completions for control flow keywords after `#` and for `solid:` elements, and code actions that wrap selected markup in `#if`, `#for`, `#loading` or `#try`, or extract it to a `#template`. The VS Code extension drops its control flow snippets, since the language server completes them in every editor.
