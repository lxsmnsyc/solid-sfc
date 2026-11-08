# labels

`scope.ts` is a copy of `lxsmnsyc/solid-labels` `packages/core/compiler/scope.ts` (branch `1.0`).

- Last synced upstream commit: `b538dbc` (name scopes, parameter defaults), plus the `scope.ts` part of PR #60 (head `9ad98b3`, for-in/for-of heads and update targets), which was open when synced.
- Differences from upstream: the import is `./ast.ts`, and `JSXName.binding` (the `binding` field in the type and the `binding: binding ?? null` line) is added here.
- A fix in one copy is made in the other. Update the commit above when you sync.
- `test/labels/scope.test.ts` covers the ported cases.
