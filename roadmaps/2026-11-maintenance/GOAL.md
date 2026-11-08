---
milestones: [1.0.x, quality, website]
run: parallel
review: auto
merge:
  mode: maintainer
branches:
budget:
release:
  publish:
---

# solid-sfc maintenance, November 2026

## Outcome

Dependencies are current, the open issues (#1, #4, #5) are closed, the compiler, scope analysis, CSS pipeline and editor support are covered by property-based, model-based or oracle tests, compile speed is measured with a baseline and improved where a profile shows cost, and the website has a new design.

## Acceptance

- `pnpm install --frozen-lockfile && pnpm build && pnpm test && pnpm typecheck && ./node_modules/.bin/oxlint && pnpm format:check` passes.
- `pnpm -r outdated` lists only majors that a node dropped with a reason.
- Issues #1, #4 and #5 are closed.
- `benchmarks/` has a compile benchmark with a recorded baseline and after numbers.

## Priorities

- must: the next patch release of every package (milestone 1.0.x): dependency updates and the scope fixes from #5.
- should: tests that find bugs (PBT, MBT, oracle), measured perf work, Open Graph tags, the website redesign.
- could: major bumps with no user-facing gain, issue replies.
- later: parked.

## Constraints

- Node >= 22 stays the minimum (`engines`). `@types/node` follows the minimum, not the latest.
- `typescript-api` (the JS API used by Volar) stays on TypeScript 6. TypeScript 7 has no stable JS API.
- Solid 2.0 is a release candidate. Bump `solid-js`, `@solidjs/*` together and keep the `minimumReleaseAgeExclude` list in `pnpm-workspace.yaml` in step.
- `packages/solid-sfc/src/labels/scope.ts` is a copy of `lxsmnsyc/solid-labels` `packages/core/compiler/scope.ts` (branch `1.0`). A fix in one copy is made in the other.
- The repo is public. It has only a release workflow, no check workflow: run checks locally.

## Non-goals

- New `.solid` syntax or compiler features.
- TypeScript 7 for the language tools.

## Verification

- Fast check: `pnpm build && pnpm test && pnpm typecheck` (about 1 minute, no shared resources).
- Full check: fast check plus `./node_modules/.bin/oxlint && pnpm format:check && pnpm --filter website build`.
- Note: `pnpm lint` exits 1 under the rtk shell wrapper with no output; run `./node_modules/.bin/oxlint` directly.

## Numbered resources

- None. Changesets use random names.

## Hot files

- `pnpm-lock.yaml`, every `package.json`, `pnpm-workspace.yaml`: only dependency nodes edit them. `deps-minor` adds `fast-check` so test nodes do not touch the lockfile.

## Sources

- User request, 2026-11-08: update dependencies, fix submitted issues, check for PBT/MBT/oracle use, check for perf improvements, redesign the website.
- Issues #1, #4, #5. solid-labels #46-#49, commit `b538dbc` on `1.0`, PR #60.

## Coverage

- update dependencies -> deps-minor, deps-solid-rc, deps-majors
- issue #1 (2022, context in old SFC) -> issue-1-reply
- issue #4 -> og-tags
- issue #5 -> fix-scope, fix-scope-48
- PBT/MBT/oracle -> test-scope-oracle, test-css-pbt, test-compile-pbt, test-editor-mbt
- perf -> bench, perf-scope, perf-compile
- website redesign -> website-redesign (outline story)
- `packages/solid-sfc/_probe.ts` is a committed debug script -> deps-minor removes it
- no check workflow -> inbox: user asked for no CI changes

## Open questions


## Gates

- website-redesign: user approved the v3 shell and hero prototype on 2026-11-08 ("design is good enough").
- issue-1-reply: user approves the comment text.
