# Outcome: test-compile-pbt

Branch `test/compile-pbt`, draft PR #21 (https://github.com/lxsmnsyc/solid-sfc/pull/21). Review: fresh review needed.

## Built

- `packages/solid-sfc/test/arbitraries/solid.ts`: fast-check arbitraries. `solidFile` builds files from the docs grammar (module and instance script, styles with interpolations and `:global`, elements, attributes in every value form, dynamic tags, all control blocks, `#template`). `nearValid`, `manyEdits`, `brokenBlock` and `brokenMarkup` apply cuts, insertions, deletions, swaps and removed chunks.
- `packages/solid-sfc/test/compile.pbt.test.ts`: seed 20261108 (override with `PBT_SEED`, `PBT_RUNS`), 300 runs, the failure message has the seed and the shrunk case. Properties:
  - on `solidFile` and `nearValid`: `compile()` returns or throws an `SFCError` with an offset in the source and a matching line and column; the output parses as TSX; every source map position is inside the source and the output.
  - on `solidFile`: same input gives same output; every generated file compiles (keeps the grammar in step with the docs).
  - on `brokenBlock`: same error property.
  - block scanner (`TemplateParser`): blocks and markup ranges join to the input; block bounds are ordered and the closing tag matches; `Scanner.scanExpression` ends at the closing bracket for any generated expression.
  - four `it.fails` findings (below).

## Findings

All four are bugs in `src/`. Not fixed here. Each is an `it.fails` test; change it to `it` with the fix.

1. `#for` header is broken by a comment or a regular expression. `findWord` in `src/control.ts` (used for `of` and `by`) does not skip comments or regex literals, so `}` or `)` in them changes the depth, and `by` in a comment is read as the keyword.
   - Shrunk: `#for (item of list /* } */ by item.id) {\n<p />\n}` throws "Expected `}` but found `Identifier`". Also `#for (item of list /* by */) {...}` and `#for (item of items.filter((i) => /[}]/.test(i)) by item.id) {...}`.
2. A `//` comment at the end of a block header swallows the `}` the compiler writes after it. The output does not parse. `compile()` throws "Unexpected token" at a line that is not the cause.
   - Shrunk: `#if (a // note\n) {\n<p />\n}`. Same for `#else if`, `#case`, `#repeat`, `#portal`, `#for` (with and without `by`). `#key`, `#template`, attributes and `{}` children are fine.
3. A dynamic tag that ends the file, after a `<script>` or a `<style>` with an interpolation, puts `; })()}` into the script, so the second pass fails. The error is at the end of the script (or 1:1), not at the tag. `compileStructure` succeeds. One more character after the tag (a newline) hides it.
   - Shrunk: `<script></script><{t}/>`. Also `<style>.a{width:${b}}</style><{t}></>`. Another scratchpad folder, `fix-dynamic-tag-eof`, suggests a fix is already in progress.
4. An unbalanced selector throws the raw `Error` of postcss-selector-parser, not an `SFCError` (no location).
   - Shrunk: `<style>] {}</style><p />` ("Expected an opening square bracket."). Also `a]`, `a)`, `a::`, `.a].b`.

Searched without further findings: 12000 runs each (seeds 1-3) of the committed properties, plus 80000 runs of `brokenBlock` and `brokenMarkup` and 30000 runs of files with three edits, for raw errors, unparsable output, bad locations and out-of-range source map positions.

## Deviations

- The brief says "scanner (`src/scanner.ts`): block boundaries reproduce the input". Block boundaries come from `TemplateParser` (`src/template.ts`), not the scanner, so that property uses `TemplateParser`. `Scanner.scanExpression` has its own property.
- Top-level `#template` and block-start templates are generated only where the docs allow them. The file always ends with a newline in `solidFile`, so finding 3 does not hide the other properties.
- The compile outcome is cached by source, so the properties of one corpus compile each source once.

## Gotchas

- Every `it.fails` test must change to `it` when its bug is fixed, or vitest reports it as failing.
- Files get big fast: depth 2 and at most 3 children keep one compile at about 2 ms.
- `pnpm typecheck` needs explicit types on exported arbitraries (isolatedDeclarations).
- `./node_modules/.bin/oxfmt --check` reports `website/index.html` and `website/preview.html`. Both are outside this node.

## Proposed learnings

- Scan header text with the JS scanner, not with character loops, wherever `/`, quotes or comments can appear | findings 1 and 2 share the cause | packages/solid-sfc/src | yes (the findings tests)
- Wrap third-party parser errors into `SFCError` | finding 4 | packages/solid-sfc/src | yes

## Verification

- `pnpm --filter solid-sfc test`: 389 passed, 4 expected fail (22 files, 4.1 s). The PBT file alone: 0.8 s.
- `pnpm typecheck`: pass.
- `./node_modules/.bin/oxlint`: no output (clean).
- `./node_modules/.bin/oxfmt --check`: only `website/index.html` and `website/preview.html`, not changed by this node.

## Size

- Estimated M, actual M.
