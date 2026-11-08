# Outcome: examples-idioms

## Built

- Branch `docs/examples-idioms`, commit `49a8202`, PR #13 (ready for review, not merged).
- Samples rewritten to `contracts/solid-idioms.md` in `website/src/examples/*.solid`, `examples/tasks/src/*.solid`, `website/docs/{markup,control-flow,components}.md` and `packages/solid-sfc/README.md`:
  - 22 assignment arrow bodies lose their parentheses (`onClick=(() => tab = item)`).
  - Shorthands: `<dt {id}>` (Templates.solid), `<Chart {data} />` (control-flow.md), `<button {...rest} {disabled}>` (components.md, replaces `disabled=(disabled)`).
  - markup.md no longer recommends `value=(count)`; intro says markup compiles to JSX but is not JSX.
  - README: `<input ... />` becomes `<input ...>`.
- New section "Writing idiomatic markup" in `website/docs/markup.md`: a before/after table of the rules plus a `#catch` block-script example.
- Idioms beyond the contract, applied:
  - `$isPending(quote)` inline in markup instead of a `const pending = () => $isPending(quote)` accessor (AsyncData.solid, QuoteCard.solid). Matches reactivity.md.
  - A handler that needs a block value (`reset` of `#catch`) is declared in a script at the start of the block and passed bare: `onClick=retry` (AsyncData.solid, QuoteCard.solid).
  - `#if`/`#else` instead of `cond ? text : ''` string ternaries in the Forms output.
  - markup.md map sample uses `class=item.kind` instead of the React-only `key=item.id`.

## Deviations

- Kept on purpose:
  - Value ternaries that pick a word or glyph, not markup: `{count === 1 ? 'time' : 'times'}` (Counter), `{index % 2 === 0 ? '●' : '■'}` (Tabs), the `plural` template (TaskBoard), `aria-pressed=(item.id === tab ? 'true' : 'false')` (tasks App), `{error instanceof Error ? ... : ...}`.
  - markup.md "Children" `.map()` sample: it shows that JSX inside expressions uses the same attribute syntax, and is followed by the `#for` form.
  - Parenthesized arrow bodies inside `<script>`: formatter style (rule 9).
  - `keyed={(item) => (item.id)}` in docs: it is the compiler output.
  - Single-assignment inline handlers stay inline (rule 4 only names multi-statement ones), including the tasks theme toggle.
- components.md: one line changed (line 184), to keep the rebase with PR #10 small.

## Stubs left

- None.

## Gotchas

- Compiler bug (not fixed, outside owned paths): a file whose markup ends with a dynamic tag `</>` and no trailing newline, with a `<script>`, compiles to broken TSX: the `; })()}` suffix is inserted after the first script line and after the script statement. Repro: the markup.md "Dynamic tags" sample without the final newline gives `Unexpected token (Sample.solid:2:44)`. Real files end with a newline, so it rarely shows; the playground editor may hit it.
- Block scripts can read `#catch` parameters; `reset()` stays a plain call in the output.

## Proposed learnings

- Read block parameters such as `reset` from a script in the block, not through an inline multi-statement arrow | keeps handlers bare | website/src/examples, examples/ | no

## Verification

- `pnpm --filter website build`, `pnpm --filter tasks build`, `pnpm --filter ssr build`: pass.
- Every example `.solid` file compiles with `compile` (scratchpad `check-files.ts`).
- Markdown blocks (scratchpad `check-md.ts`, blocks get a trailing newline): 81 of 83 `html` blocks compile. Skipped: migration.md:79 (0.x "Before" with an unclosed `<button>` fragment) and migration.md:100 (`<solid:suspense>`, 0.x syntax).
- Built site, playground: all eight examples render; Async data break/retry, pending disables Next, Todo "Clear done", Forms delivery toggle work.
- `pnpm build && pnpm test` (364 + 50 + 21 tests) `&& pnpm typecheck && oxlint && oxfmt --check`: pass. No snapshot changed.

## Size

- Estimated M, actual M.
