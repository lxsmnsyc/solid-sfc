---
id: test-scope-oracle
title: Oracle test for scope analysis against eslint-scope
status: todo
priority: should
type: feature
milestone: quality
size: M
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/test/labels/scope.oracle.test.ts
  - packages/solid-sfc/test/labels/arbitraries.ts
depends_on:
  - on: deps-minor
    kind: hard
    why: needs fast-check in the lockfile
  - on: fix-scope
    kind: behavior
    via: scope-analyze
---

# Oracle test for scope analysis against eslint-scope

## Goal

Compare `analyze()` from `src/labels/scope.ts` with a reference implementation on generated programs. oxc-parser emits ESTree, so `eslint-scope` (devDependency) can analyze the same AST. For each identifier reference, both must agree on the binding it resolves to and on read or write. Programs come from fast-check arbitraries that combine declarations, shadowing, loops (`for of/in` with bare targets), classes and class expressions, parameter defaults, closures and updates.

## Context

- Contract `scope-analyze`: `analyze(program)` and the `Ref`/`Binding` shapes at the top of `src/labels/scope.ts`.
- Bugs this would have found: issue #5. Known gaps until fix-scope-48 lands (TS-only syntax) are out of the generator's grammar; eslint-scope does not model TS anyway.

## Acceptance

- [ ] Property test with at least 500 runs per `pnpm test`, deterministic seed reported on failure.
- [ ] Every disagreement found is either fixed in a follow-up node (listed in the outcome) or documented as an intended difference with a filter in the test.

## Sizing

M: known pattern, new to this repo; `eslint-scope` comes from deps-minor.

## Notes for the worker

- deps-minor adds `eslint-scope` as a devDependency.
- Do not fix scope.ts here. Report findings; the orchestrator adds fix nodes.
