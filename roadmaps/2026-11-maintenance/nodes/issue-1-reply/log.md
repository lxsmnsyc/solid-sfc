# Log: issue-1-reply

- 2026-11-08: Branch `docs/issue-1-reply` reset to `origin/main` (1ca2128). Install and build passed.
- Solid 2.0 rc.15 (`solid-js/types/client/core.d.ts`): `Context<T>` extends `FlowComponent<{ value: T }>`, so `<ThemeContext value=...>` is the provider. No `.Provider`.
- Fixtures in `packages/solid-sfc/test/fixtures/context/`: `ThemeProvider.solid` (context in `<script module>`), `ThemeLabel.solid` (consumer), `App.solid`, `main.js`.
- Compiled output: `export const ThemeContext = createContext(...)` sits at module top level before `export default function ThemeProvider`. Consumer imports `{ ThemeContext } from './ThemeProvider.solid'`.
- esbuild bundle with `compiler: { generate: 'ssr' }`, platform node, Solid bundled in: `renderToString` gives `<p>light</p><p>dark</p>`.
- Added a "Context" section to `website/docs/components.md` under "The script".
- Checks: solid-sfc tests 366 passed, oxfmt clean, oxlint clean, typecheck clean, website build passed.
- Commit d2063e1, pushed, PR #10 opened as draft and marked ready.
- Worktree isolation refused writes to the shared checkout, so log.md and outcome.md were written to the scratchpad for the orchestrator to copy.
