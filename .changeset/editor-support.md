---
'@solid-sfc/language-core': minor
'@solid-sfc/language-server': minor
'@solid-sfc/tsc': minor
'@solid-sfc/typescript-plugin': minor
'solid-sfc': minor
'solid-sfc-vscode': minor
---

Add editor and type-checking support for `.solid` files.
`@solid-sfc/tsc` type-checks a project with `solid-tsc`, and `@solid-sfc/language-server` provides editor features.
`solid-sfc` exports `compileStructure`, which returns the TSX that type-checking uses.
`@solid-sfc/typescript-plugin` gives `.ts` files that import `.solid` files the props types in the TypeScript server.
