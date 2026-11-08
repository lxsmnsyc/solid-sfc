# Outcome: fix-dynamic-tag-eof

## Built

- Fix in `packages/solid-sfc/src/template.ts`: private `appendAfter(index, text)`, used by `parseDynamicElement` for the closing `; })()}`. Test in `packages/solid-sfc/test/template-eof.test.ts` (dynamic tag, self-closing dynamic tag, plain element, component, no trailing newline, parsed with oxc-parser). Changeset `.changeset/fix-dynamic-tag-eof.md` (patch, solid-sfc). PR #16 (branch `fix/dynamic-tag-eof`).

## Proof

- base: e11e96d, `pnpm --filter solid-sfc exec vitest run test/template-eof.test.ts`: dynamic tag case fails with `Unexpected token (2:44)`; the other cases pass.
- branch: same command: 4 of 4 pass.

## Deviations

- Commit subject is "fix-dynamic-tag-eof: Dynamic tag at end of file compiles to broken TSX" (70 chars), because the plain-writing hook rejects the 78-char subject.
- Added a self-closing dynamic tag case, which has the same cause.
- `compileForEditor` needed no change: it shares the code path and is fixed by this one.

## Stubs left

- None.

## Gotchas

- magic-string keeps text appended at an index when `snip` removes the chunk around it. Any `appendLeft(source.length, ...)` surfaces in the first snipped range. Other appends at the end of the source would need the same care.

## Proposed learnings

- Do not append to the output at `source.length`; `snip` leaks it into other ranges | magic-string keeps appended content on removed chunks | packages/solid-sfc/src | yes

## Verification

- `pnpm build && pnpm test && pnpm typecheck`, `./node_modules/.bin/oxlint`, `./node_modules/.bin/oxfmt --check`: all pass.

## Size

- Estimated S, actual S.
