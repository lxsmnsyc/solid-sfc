# labels

`scope.ts` is a copy of `lxsmnsyc/solid-labels` `packages/core/compiler/scope.ts` (branch `1.0`). `reactive.ts` follows `packages/core/compiler/reactive.ts` for the write rewrite.

- Last synced upstream commit: `b538dbc` (name scopes, parameter defaults), plus PR #60, merged as `a7a4ba7` (for-in/for-of heads and update targets in `scope.ts`, TS wrappers on update targets in `reactive.ts`).
- `scope.ts` is also synced with upstream `180dd87` (PR #61 decorators, namespaces, enums, parameter properties and `import =`; PR #64 enum and namespace merging). `reactive.ts` is not synced past the commit above.
- Differences from upstream: the import is `./ast.ts`, and `JSXName.binding` (the `binding` field in the type and the `binding: binding ?? null` line) is added in `scope.ts`. `reactive.ts` here has no `unused` handling in `rewriteWrite`.
- A fix in one copy is made in the other. Update the commit above when you sync.
- `test/labels/scope.test.ts` and `test/labels/signal-writes.test.ts` cover the ported cases.
