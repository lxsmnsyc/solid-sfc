# Log: examples-idioms

- Set up branch `docs/examples-idioms` from origin/main (e11e96d), install and build.
- Read markup, control-flow, reactivity, components docs and the contract.
- perl pass: stripped parens around assignment arrow bodies in markup (22 lines).
- Manual: `{id}`, `{data}`, `{disabled}`, README void input, markup.md note on `value=(count)`.
- AsyncData and QuoteCard: inline `$isPending`, `retry` in a `#catch` block script. Checked compiled output: `reset()` stays a plain call.
- Forms output: `#if` blocks instead of string ternaries.
- markup.md: new "Writing idiomatic markup" section, intro reworded, oxfmt formatted the table.
- check-md.ts first failed on the markup.md dynamic tag sample; traced to a compiler bug when the source ends with `</>` and no newline. Added a trailing newline in the checker. On main the same sample fails the same way.
- Builds, tests, typecheck, lint, fmt pass. Playground checked in the browser against `vite preview`.
- Commit 49a8202, PR #13, marked ready.
