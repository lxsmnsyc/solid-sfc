---
'solid-sfc': patch
---

Support `"use server"` functions in `.solid` files with the `serverFunctions` option of `@solidjs/vite-plugin`, in SSR and client start mode. Its transform reads `.solid` modules under a `.tsx` name, which Solid's compiler accepts.
