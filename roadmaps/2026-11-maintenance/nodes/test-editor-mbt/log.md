# Log: test-editor-mbt

- fast-check was already in language-core devDependencies (deps-minor merged).
- Model: file text. Real: language plugin, kept alive through `updateVirtualCode` like Volar. Commands: Insert, Delete, Type (char by char, completions after each char), Ask (completions, code actions on whole lines).
- First run found two oracle mistakes of mine, not bugs:
  - `compileStructure` leaves markup expressions to TypeScript, so `<p>a > b</p>` has no error in `compileForEditor` while its TSX has a syntax error. By design (TS reports it). "Valid" is now defined as `compile()` succeeding.
  - Style code masks `${}` with placeholders, so source text differs from generated text there. The text-equality check covers root and `tsx` only, and only mappings with `structure: true`, no `generatedLengths`.
- Real finding on seed 3 at 3000 runs: raw postcss-selector-parser `Error` escapes `compileForEditor`. The same cause as finding 4 of test-compile-pbt. The model skips edits that cause it (`hitsRawSelectorError`), any other raw error fails the property. `it.fails` repros added.
- Searched after that: seeds 1-4 at 3000 runs, 11-12 at 5000 runs: clean. Runtime about 5 s per 1000 runs.

## Mutation checks (inject by hand, FC_RUNS=300, then restore)

Each bug was applied to `src/`, the test run, and `src/` restored from a copy (diff clean).

| check | injected bug | caught |
| --- | --- | --- |
| never throws | `compileForEditor` throws when source has `<solid:` | yes, `Type("<solid:")` |
| generated offset | mapping `generatedOffsets` +1 for runs longer than 3 | yes, base text |
| range bounds | mapping `lengths` +1000 when source offset > 40 | yes, base text |
| source text = generated text | same offset bug (text differs) | yes |
| incremental = fresh | `updateVirtualCode` keeps the old `tsx` code when the text has `#if` | yes, `Delete`, `Type("#if")` |
| valid text gives parseable TSX | extra `}` in TSX when source has `#for` | yes, base text |
| compileForEditor is deterministic | error dropped at random | yes |
| completion `start <= cursor` | `start = offset + 1` | yes, `Type("#if")` |
| code action edits in bounds | edit end `to + 3`, and extract edit at `source.length + 1` | yes, `Ask` |

First attempts missed three bugs (completion, action, determinism) because the property rarely reached them: cursors rarely sat after `#`, the selections were not whole lines, and the injected toggle had the wrong parity. Fixed by checking completions after every typed character and every insert, selecting whole lines in Ask, and a random toggle.
