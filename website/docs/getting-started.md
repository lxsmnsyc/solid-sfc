# Getting started

`solid-sfc` needs SolidJS 2.0 and Vite 8.

## Install

```bash
pnpm add solid-js @solidjs/web solid-sfc
pnpm add -D vite @solidjs/vite-plugin @solid-sfc/tsc
```

`solid-sfc` is a regular dependency, because compiled components can import `solid-sfc/runtime`.

## Configure Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import solidSFC from 'solid-sfc/vite';

export default defineConfig({
  plugins: [solidSFC()],
});
```

`solid-sfc/vite` includes `@solidjs/vite-plugin`. Do not add `@solidjs/vite-plugin` to the plugin list again. To pass options to it, use the `solid` option:

```ts
solidSFC({
  solid: { ssr: true },
});
```

## Configure TypeScript

```json
{
  "compilerOptions": {
    "module": "preserve",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "jsxImportSource": "@solidjs/web",
    "types": ["vite/client", "solid-sfc/client"]
  }
}
```

`solid-sfc/client` declares two things:

- The global compile-time functions, such as `$signal`.
- The `*.solid` module type, which `tsc` uses when it cannot read `.solid` files.

Type-check with `solid-tsc` instead of `tsc`. It reads `.solid` files and gives imports of components their real props type.

```json
{
  "scripts": {
    "typecheck": "solid-tsc --noEmit"
  }
}
```

## Write a component

```html
<!-- src/Counter.solid -->
<script>
  const { initial = 0 } = $props<{ initial?: number }>();
  let count = $signal(initial);

  function increment() {
    count += 1;
  }
</script>

<style>
  button {
    padding: 0.5rem 1rem;
  }
</style>

<button onClick=increment>Count: {count}</button>
```

Import it like any other component:

```tsx
// src/main.tsx
import { render } from '@solidjs/web';
import Counter from './Counter.solid';

render(() => <Counter initial={5} />, document.getElementById('app')!);
```

## Editor support

Install the Solid SFC extension for VS Code. It adds highlighting, type checking, hover, completion and go-to-definition for `.solid` files. Other editors can run [`@solid-sfc/language-server`](./tooling.md#language-server).

## Next steps

- [Components](./components.md) explains each part of a `.solid` file.
- [Reactivity](./reactivity.md) explains `$signal` and the other compile-time functions.
