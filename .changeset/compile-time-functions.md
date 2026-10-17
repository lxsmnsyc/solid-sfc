---
'solid-sfc': minor
---

Compile-time functions such as `$signal` and `$memo` now come from the `solid-labels` 1.0 compiler, which is included in `solid-sfc`.
They target Solid 2.0, and destructuring `$props()` keeps props reactive.
Labels such as `effect:` and comment directives are no longer supported. Remove `solid-labels` and `@babel/core` from your dependencies.
