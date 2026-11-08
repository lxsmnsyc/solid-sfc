# Outcome: test-css-pbt

## Built

- Branch `test/css-pbt`, draft PR #20. `packages/solid-sfc/test/minify.pbt.test.ts` and `packages/solid-sfc/test/style.pbt.test.ts`. Seed 20261108, 400 runs per property, about 1 s together. `FC_SEED` and `FC_RUNS` override.
- minify: oracle against postcss, idempotence, no comments or brace spacing left, strings, escapes and `url()` byte for byte, plus shrunk regressions for escapes.
- scoping: attribute last before the pseudo-element, `:global(...)` replacement with scoping of the last other compound, SCSS and Less attribute at start, global blocks untouched, keyframes and `animation` renamed together.
- Used `compile()` for scoping because `processStyles` needs parsed blocks. Output is read from `css.code` with `dev: true`.

## Proof

- base: three failing-test commits (`1fc5742`, `d43c9ec`) fail on the old `src/`; shrunk repros below.
- branch: same tests pass; also 10000 runs at seed 99 and 20000 runs at seed 7 pass.

Fixed (each under 20 lines, patch changesets `tidy-escapes-hold`, `calm-lists-scope`):
- `minify.ts`: escapes outside strings. `.a\ ,.b` -> `.a\,.b`; `a{c:x\,  d}` -> `x\,d`; `b\"  d  "e  f"` collapsed the string; `a{c:d\ ;}` -> `a{c:d\}` (postcss trims the escaped space; swallows the brace).
- `style.ts` `scopeSelector`: whitespace before a later list item moved after the attribute. `.a, ::before` -> `.a[s-x],[s-x] ::before`; SCSS/Less `.a, .b` -> `[s-x].a,[s-x] .b`.
- `style.ts` `renameAnimations`: keyframes named `s` turned `1s` into `1s-x`. Lookbehind `(?<!\w)`.

## Deviations

- The fixes for the selector list and the keyframe unit share one failing-test commit (`d43c9ec`) because both live in `style.pbt.test.ts`.
- The final commit holds typecheck and lint cleanups of the test files.

## Left for a follow-up (no tests)

- `.a:global(.b)` (global inside a mixed compound) is left unscoped (`.a.b`). Unclear if intended; docs only show global as a whole compound.
- `animation: url(k)` and strings in `animation` values are renamed along with keyframe names.
- Unquoted `url(a  b)` collapses to `url(a b)` (invalid CSS anyway).

## Gotchas

- `pnpm exec oxfmt --check` fails on `website/index.html` and `website/preview.html`. Not from this branch.
- Under load the first run was slow because fast-check shrinks failures; passing runs take about 1 s.

## Proposed learnings

- Test CSS with escapes and with leading whitespace in selector lists | both broke passes that looked right on tidy input | packages/solid-sfc/test | yes

## Verification

- `pnpm --filter solid-sfc test`: 399 pass. `pnpm typecheck`: clean. `oxlint`: clean. `oxfmt --check`: only the two website HTML files fail.

## Size

- Estimated M, actual M.
