---
'solid-sfc': minor
---

Compile-time functions such as `$signal` and `$memo` no longer depend on `solid-labels`.
The compiler supports the compile-time functions of `solid-labels`, and destructuring `$props()` keeps props reactive.
Labels such as `effect:` and comment directives are no longer supported. Remove `solid-labels` and `@babel/core` from your dependencies.
