---
id: deps-minor
title: Bump dependencies within their ranges and add fast-check
status: done
priority: must
type: chore
milestone: 1.0.x
size: M
verify: pnpm build && pnpm test && pnpm typecheck
owns:
  - package.json
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
  - packages/solid-sfc/_probe.ts
shared:
  - .changeset/*.md
depends_on: []
---

# Bump dependencies within their ranges and add fast-check

## Goal

Bring every non-Solid dependency to its latest minor or patch, keep pinned wasm bindings in step with their hosts, add `fast-check` as a dev dependency of `solid-sfc` and `@solid-sfc/language-core`, and `eslint-scope` to `solid-sfc`, for the test nodes, and remove the committed debug script `packages/solid-sfc/_probe.ts`.

## Context

`pnpm -r outdated` at `1ca2128`: Volar 2.4.28 -> 2.4.31 (pinned exact, all `@volar/*` together), oxc-parser and oxc-transform 0.154 -> 0.157 (the pinned `@oxc-parser/binding-wasm32-wasi*` and `@oxc-transform/binding-wasm32-wasip1` in `packages/vscode` and `website` must match), tsdown 0.23.7, vitest 5.1, oxlint 1.92, oxfmt 0.77, magic-string, postcss, postcss-selector-parser, unplugin 3.7, rolldown 1.3, rollup 4.68, sass, ovsx.

## Acceptance

- [ ] `pnpm -r outdated` lists only Solid packages (`solid-js`, `@solidjs/*`, `terracotta`) and majors (`@types/node`, `markdown-it`, `postcss-less`, `typescript` 7 for `typescript-api`).
- [ ] `fast-check` is in devDependencies of `packages/solid-sfc` and `packages/language-core`; `eslint-scope` in `packages/solid-sfc`.
- [ ] Full check from GOAL.md passes, including `pnpm --filter website build`.
- [ ] A patch changeset for packages whose runtime dependencies changed.

## Sizing

M: many manifests, mechanical, tests prove it.

## Notes for the worker

- Leave `solid-js`, `@solidjs/*`, `terracotta`: deps-solid-rc owns them.
- The rollup and webpack entries in `minimumReleaseAgeExclude` name exact versions. Update them when bumping, or drop entries no longer needed.
- New oxlint or oxfmt versions may flag new rules or reformat: fix in owned code only if trivial, else note it in the outcome.
