# Outcome: test-editor-mbt

Branch `test/editor-mbt`, draft PR (see the report for the number).

## Built

- `packages/language-core/test/editor.mbt.test.ts`: model-based test with `fc.commands`. The model is the file text. The real system is the language plugin, updated with `updateVirtualCode` after every edit.
- Commands: `Insert` (characters, half-typed tags, unclosed blocks, interpolations), `Delete`, `Type` (a keyword or tag one character at a time), `Ask` (completions and code actions).
- Seven base files (plain markup, script, `#for`, style, `#if` with style interpolation, `#switch`, `#template`). Seed 20261108, 150 runs by default. `FC_SEED` and `FC_RUNS` override. The failure message starts with the seed and the shrunk command sequence.
- Checks after each step:
  - `compileForEditor` does not throw.
  - Every mapping of root, `tsx` and `style_*` has offsets and lengths inside both texts. Copy mappings (full features, `structure: true`, no `generatedLengths`) have equal source and generated text.
  - Oracle: the virtual code kept across edits equals a fresh `createSolidVirtualCode` of the same text (ids, texts, mappings).
  - Oracle: `compileForEditor` on the same text twice gives the same error and warning count.
  - When `compile()` accepts the text: `compileForEditor` has no error and a result, and the TSX parses without errors.
  - Completions have `0 <= start <= cursor`, after each typed character and at random cursors. Code action edits are ordered and inside the text.
- Two `it.fails` tests for the finding below.

## Findings

1. A style selector that postcss-selector-parser rejects makes `compileForEditor` throw a plain `Error` (no `SFCError`, no location). The language plugin throws on every keystroke while the selector is half typed.
   - Shrunk: base `<style>\n  p { color: red; }\n</style>\n\n<p class="a">text</p>\n`, then `Insert(0, "/")`, `Insert(0, "<style>")`.
   - Direct: `compileForEditor('<style>] {}</style><p />')`. Same cause as finding 4 of test-compile-pbt (compiler side). Fix: wrap the parser error in `SFCError` in `src/` (style), or catch it in `recovery.ts`.
   - The model skips edits that cause it, so the rest of the property can run.

No other finding in seeds 1-4 (3000 runs) and 11, 12 (5000 runs).

## Deviations

- "Valid source" means `compile()` accepts it, not `compileStructure`. `compileStructure` leaves markup expressions to TypeScript, so a `>` in text is no error in the editor path but is a TSX syntax error.
- "Same diagnostics count after the sequence versus fresh": `compileForEditor` is pure, so the test compares the virtual code kept through `updateVirtualCode` with a fresh one, and compiles twice for the counts.
- Style code is not checked for text equality: `${}` is masked by placeholders on purpose.

## Gotchas

- Each `it.fails` must become `it` when finding 1 is fixed, and `hitsRawSelectorError` can then be removed.
- Vitest writes `packages/language-core/.vitest/`; it is untracked and not committed.
- `oxfmt --check` still lists `website/index.html` and `website/preview.html` (outside this node).

## Proposed learnings

- Wrap every third-party parser error in `SFCError` | the editor path rethrows non-`SFCError` errors, and it runs on each keystroke | packages/solid-sfc/src | yes (the findings tests)

## Verification

- `pnpm --filter @solid-sfc/language-core test`: 51 passed, 2 expected fail, 1.1 s. The MBT alone about 0.8 s.
- `pnpm typecheck`: pass.
- `./node_modules/.bin/oxlint`: clean.
- `./node_modules/.bin/oxfmt --check`: only website/*.html.

## Size

- Estimated M, actual M.
