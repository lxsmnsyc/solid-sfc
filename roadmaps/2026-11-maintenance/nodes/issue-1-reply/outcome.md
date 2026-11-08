# Outcome: issue-1-reply

## Built

- `website/docs/components.md`, new section "Context" (anchor `#context`) under "The script": create the context in `<script module>`, export it, provide it with `<ThemeContext value=...>`, read it from another file with `useContext`.
- `packages/solid-sfc/test/context.test.ts` with fixtures in `packages/solid-sfc/test/fixtures/context/`. It checks the compiled output exports the context at the top level, and renders the app on the server (esbuild, `generate: 'ssr'`) to `<p>light</p><p>dark</p>`.
- PR #10: https://github.com/lxsmnsyc/solid-sfc/pull/10 (ready, not merged). Branch `docs/issue-1-reply`, commit d2063e1.

## Deviations

- Added `packages/solid-sfc/test/context.test.ts` and `packages/solid-sfc/test/fixtures/context/*`, outside the owned path, as the orchestrator asked, to prove the example works.
- No changeset: the change is docs and a test, nothing in a published package changes.

## Stubs left

- None.

## Gotchas

- Solid 2.0 rc.15 has no `Context.Provider`. The context object is the provider component.

## Proposed learnings

- None.

## Verification

- `pnpm --filter solid-sfc test`: 19 files, 366 tests passed.
- `./node_modules/.bin/oxfmt --check`: clean. `./node_modules/.bin/oxlint`: clean. `pnpm --filter solid-sfc typecheck`: clean. `pnpm --filter website build`: passed.

## Size

- Estimated S, actual S.

## Issue reply (draft, not posted)

````markdown
The compiler was rewritten since 2022, and a `.solid` file can now export values from `<script module>`. That code runs once at the top level of the module, so it is the place for a context:

```html
<!-- ThemeProvider.solid -->
<script module>
  import { createContext } from 'solid-js';

  export const ThemeContext = createContext<'light' | 'dark'>('light');
</script>

<script>
  import type { Element } from 'solid-js';

  const props = $props<{ theme: 'light' | 'dark'; children: Element }>();
</script>

<ThemeContext value=props.theme>{props.children}</ThemeContext>
```

Other files import it with `import { ThemeContext } from './ThemeProvider.solid'` and read it with `useContext(ThemeContext)`. In Solid 2.0 the context is its own provider component, so there is no `.Provider`.

Docs: https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/components.md#context
PR with the docs and a test: #10

Closing this one. Open a new issue if something does not work.
````
