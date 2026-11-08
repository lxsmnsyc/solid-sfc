# Log: fix-dynamic-tag-eof

- Base e11e96d. Wrote packages/solid-sfc/test/template-eof.test.ts first.
- Command: `pnpm --filter solid-sfc exec vitest run test/template-eof.test.ts`. Result on base: dynamic tag case fails with `SFCError: Unexpected token (<anonymous>:2:44)`; plain element and component pass.
- Root cause: `parseDynamicElement` in template.ts does `output.appendLeft(end, '; })()}')` with end == source.length. magic-string keeps appended text when `snip` removes a chunk, so `assemble` in compile.ts emitted it inside the script range. Reproduced with magic-string alone: `appendLeft(6, 'X')` then `snip(0, 3)` gives `abcX`.
- Fix: `appendAfter` in template.ts puts the text on the last character with `update` when the index is the end of the source.
- compileForEditor: shares compileStructure, so the same fix covers it. Checked with a temporary test (removed).
- Commit message subject shortened to 70 chars because the plain-writing hook rejects 78.
- Checks: build, test (368, 50, 21 pass), typecheck, oxlint, oxfmt --check all clean.
- PR #16, marked ready after self-review (no findings).
