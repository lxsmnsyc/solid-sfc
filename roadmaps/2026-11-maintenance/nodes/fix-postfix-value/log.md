# Log: fix-postfix-value

- Base 4d3e624. Test added to packages/solid-sfc/test/labels/signal-writes.test.ts (labels transform plus a stub createSignal, not a full .solid bundle).
- Command: `pnpm --filter solid-sfc exec vitest run test/labels/signal-writes.test.ts`. Base result: failed, `const y = x++` gave [1, 1], expected [0, 1].
- Ported `unused` check into rewriteWrite. A concise arrow body `() => x++` counts as used, so one compile.test.ts snapshot line changed (updated with -u).
- Full `pnpm test` first run had 4 timeouts under load (bundlers, context); rerun passed 379.
- oxfmt --check flags website/index.html and website/preview.html, not touched by this branch.
- Self-review: one round, no findings.
