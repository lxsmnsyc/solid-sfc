# labels

`scope.ts` is a copy of `lxsmnsyc/solid-labels` `packages/core/compiler/scope.ts` (branch `1.0`). `reactive.ts` follows `packages/core/compiler/reactive.ts` for the write rewrite.

- Last synced upstream commit: `509d0f2`. Every file in this folder was re-ported from upstream at that commit, with the local changes below applied on top.
- Local changes:
  - Relative imports use `.ts` extensions, and class fields have type annotations for `isolatedDeclarations`.
  - `scope.ts`: `JSXName.binding` (the field in the type and the `binding: binding ?? null` line).
  - `context.ts`: `sourceNames` and `parameter(base)` give generated parameters plain names (`current`, `param`). `unique(base)` returns `base` itself when it is free, so setters are `setCount` (`setterName` in `variables.ts`). `finalize()` writes one import statement per module with single quotes.
  - `registry.ts`: `$trackedEffect` is `createTrackedEffect`. `$isPending` and `$latest` are arrow CTFs. `NAMESPACE_COMPONENTS` has only `hydration-script`, because `#for` and `#if` blocks replace the control flow elements.
  - `reactive.ts` and `effect.ts`: `refreshCallee`. `$refresh(x)` passes the accessor and does not make an effect track `x`.
  - `index.ts`: `compile` always returns a `CompileOutput`, with no `NEEDS_COMPILE` check and no `null` result, and the source map has no `includeContent`.
- A fix in one copy is made in the other. Update the commit above when you sync.
- `test/labels/scope.test.ts` and `test/labels/signal-writes.test.ts` cover the ported cases. `arrow-before-alias`, `await-write-semantics`, `dev-names-and-await-writes`, `nested-rewrites` and `scope-edges` are ported from upstream with the local names (`setCount`, `current`, `tmp`) and `$snapshot` in place of `$latest`. `upstream-sync.test.ts` covers the fixes of this sync.
