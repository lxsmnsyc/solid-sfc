---
id: deps-solid-rc
title: Bump Solid 2.0 to the latest release candidate
status: done
priority: must
type: chore
milestone: 1.0.x
size: M
verify: pnpm build && pnpm test && pnpm typecheck
owns:
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - packages/solid-sfc/package.json
  - packages/language-core/package.json
  - packages/language-server/package.json
  - packages/tsc/package.json
  - packages/typescript-plugin/package.json
  - packages/vscode/package.json
  - examples/tasks/package.json
  - examples/ssr/package.json
  - website/package.json
  - packages/solid-sfc/src/runtime.ts
  - packages/solid-sfc/src/control.ts
  - packages/solid-sfc/src/vite.ts
  - packages/solid-sfc/test/vite.test.ts
  - packages/solid-sfc/test/__snapshots__/**
  - packages/solid-sfc/test/labels/__snapshots__/**
shared:
  - .changeset/*.md
depends_on:
  - on: deps-minor
    kind: hard
    why: both rewrite pnpm-lock.yaml and the same manifests
---

# Bump Solid 2.0 to the latest release candidate

## Goal

Move `solid-js`, `@solidjs/web`, `@solidjs/signals`, `@solidjs/compiler` (and its wasm binding), `@solidjs/vite-plugin` and `terracotta` to their latest release candidate or next versions, and adapt the compiler output to any API change.

## Context

At `1ca2128`: Solid 2.0.0-rc.15 -> rc.21, `@solidjs/vite-plugin` 3.0.0-next.35 -> next.57. Read the Solid changelog between rc.15 and rc.21 for renamed or removed exports that `src/runtime.ts`, `src/control.ts` or `src/labels/*` emit (`Show`, `For`, `createSignal`, `$isPending`, `$latest`, `$refresh`).

## Acceptance

- [ ] No Solid package in `pnpm -r outdated`.
- [ ] Snapshot changes are explained in the outcome, one line per kind of change.
- [ ] `examples/tasks` and `examples/ssr` build; the SSR example renders and hydrates (`pnpm --filter ssr build`).
- [ ] Full check passes. Changeset for `solid-sfc` if the output or peer range changed.

## Widened 2026-11-08

`@solidjs/vite-plugin` next.57 matches the style query ids and changed the shape of `.vite/solid-server-functions.json`. `src/vite.ts` must adapt in the same PR (the bump breaks the website, tasks and ssr builds otherwise), with a test for both.

## Sizing

M: uncertainty medium (unknown upstream changes), tests prove it.

## Notes for the worker

- Update the exact-version entries in `minimumReleaseAgeExclude`.
- If a change outside `runtime.ts` and `control.ts` is needed (labels output, docs), stop and write it in the outcome; the orchestrator adds a node.
