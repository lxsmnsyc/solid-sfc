# Outcome: deps-minor

Branch `chore/deps-minor`, commit `7f29377`. Not pushed.

## Built

- Every non-Solid dependency on its latest minor or patch. Volar 2.4.31 (exact pins kept), oxc 0.157 with the pinned wasm bindings in `packages/vscode` and `website`.
- `fast-check` in `solid-sfc` and `@solid-sfc/language-core` devDependencies; `eslint-scope` 9 in `solid-sfc`.
- Removed `rollup@4.64.7`, its platform packages and `webpack@5.112.0` from `minimumReleaseAgeExclude`; the newer versions pass the age policy. Solid rc.15 entries left for deps-solid-rc.
- Deleted `packages/solid-sfc/_probe.ts`.
- Patch changeset for the five published packages.

## Checks

Build, 435 tests, typecheck, oxlint, oxfmt, website build, `tasks` and `ssr` builds pass. The vscode wasm parser binding loads and parses.

## Left on purpose

- `@types/vscode` ~1.100: follows `engines.vscode`.
- `@types/node` 24, `typescript` 6 for `typescript-api`: GOAL.md constraints.
- `markdown-it` 15, `postcss-less` 7: deps-majors. Solid packages: deps-solid-rc.

## Gotchas

- `pnpm peers check` reports `typescript` 7 against `@volar/language-server` (wants <7) and `@emnapi/*` 2.0.0-alpha.6 against `@napi-rs/wasm-runtime` 1.2.7. Both came from existing pins, not new; the wasm parser works.
