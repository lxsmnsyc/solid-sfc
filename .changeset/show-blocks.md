---
'solid-sfc': minor
'@solid-sfc/language-core': patch
---

`#if` compiles to `<Show>`, and `#if` with `#else if` compiles to `<Switch>` and `<Match>`. Type-checking still sees conditional expressions, so TypeScript narrows values inside each branch. `compileStructure` takes a `typeCheck` option for that.
