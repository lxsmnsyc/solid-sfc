---
'solid-sfc': minor
'@solid-sfc/language-core': minor
'solid-sfc-vscode': patch
---

Keep type information in the editor while a file has a syntax error. `SFCError` has a `recover` range, such as an unfinished tag or the opening tag of an unclosed element, and `compileForEditor` in `@solid-sfc/language-core` blanks it out and compiles the rest of the file. Without a range, it blanks the line of the error.
