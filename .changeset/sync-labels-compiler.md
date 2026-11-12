---
'solid-sfc': minor
---

Adds the compile-time functions `$onFlush`, `$isDisposed`, `$observer`, `$from`, `$flatten`, `$useHead`, `$isWrappable`, `$until`, `$lazyModule`, `$clientOnly` and `$deferred`. Fixes writes to a signal after `await` in an async function, writes through `x!` and `(x as any)`, `s = t++` between two signals, a write in a concise async arrow, and `$memo` with a parenthesized argument in dev mode.
