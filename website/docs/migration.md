# Migrating from 0.x

`solid-sfc` 1.0 replaces `babel-plugin-solid-sfc`. Components are now `.solid` files with a `<script>` block and markup, instead of `.solid.tsx` files with a JSX default export. The new version also targets Solid 2.0.

## Packages

| 0.x                                 | 1.0                                                  |
| ----------------------------------- | ---------------------------------------------------- |
| `babel-plugin-solid-sfc`            | `solid-sfc`                                          |
| `solid-labels` and its Babel plugin | Included in `solid-sfc`                              |
| `solid-styled`                      | Included in `solid-sfc`                              |
| `vite-plugin-solid`                 | `@solidjs/vite-plugin`, included in `solid-sfc/vite` |
| `solid-js` 1.x                      | `solid-js` 2.0 and `@solidjs/web`                    |

```bash
pnpm remove babel-plugin-solid-sfc solid-labels solid-styled vite-plugin-solid @babel/core
pnpm add solid-js@2 @solidjs/web solid-sfc
pnpm add -D @solidjs/vite-plugin @solid-sfc/tsc
```

Replace the Vite configuration:

```ts
// Before
import solidPlugin from 'vite-plugin-solid';
import solidLabels from 'babel-plugin-solid-labels';
import solidSFC from 'babel-plugin-solid-sfc';

export default defineConfig({
  plugins: [solidPlugin({ babel: { plugins: [solidLabels, solidSFC] } })],
});

// After
import solidSFC from 'solid-sfc/vite';

export default defineConfig({
  plugins: [solidSFC()],
});
```

In `tsconfig.json`, replace `/// <reference types="babel-plugin-solid-sfc" />` with `"types": ["solid-sfc/client"]`. See [Getting started](./getting-started.md#configure-typescript).

## Files

Rename `App.solid.tsx` to `App.solid`. The `'use solid-sfc'` directive is no longer needed.

Move the code into `<script>`, and move the default export into markup:

```tsx
// Before: Message.solid.tsx
interface Props {
  message: string;
}

const props = $props<Props>();

export default $view<Props>(<h1>{props.message}</h1>);
```

```html
<!-- After: Message.solid -->
<script>
  interface Props {
    message: string;
  }

  const props = $props<Props>();
</script>

<h1>{props.message}</h1>
```

`$view` is gone. Components get their props type from `$props<T>()`, and `solid-tsc` and the editor tools check it.

## Attribute values

Markup uses a shorter syntax for attribute values. Code with `{expression}` attribute values must change, because braces now hold an object literal:

```html
<!-- Before -->
<button onClick={increment} disabled={count() === 0}>

<!-- After -->
<button onClick=increment disabled=(count === 0)>
```

`{expression}` children work as before. See [Markup](./markup.md).

## The `solid:` elements

| 0.x                                                  | 1.0                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `<solid:fragment name="fallback">…</solid:fragment>` | An element as the attribute value: `fallback=<Loading />`. For a fallback, use a control flow block.  |
| `<solid:slot name="header" />`                       | `{props.header}`                                                                                      |
| `<solid:children />`                                 | `{props.children}`                                                                                    |
| `<solid:self />`                                     | The component's own name. The component in `Tree.solid` is named `Tree`, so it can render `<Tree />`. |
| `<solid:suspense>`                                   | `#loading { } #else { }`                                                                              |
| `<solid:error-boundary>`                             | `#try { } #catch (error, reset) { }`                                                                  |

```html
<!-- Before -->
<solid:suspense>
  <solid:fragment name="fallback">
    <h1>Loading…</h1>
  </solid:fragment>
  <Profile />
</solid:suspense>

<!-- After -->
#loading {
  <Profile />
} #else {
  <h1>Loading…</h1>
}
```

## Labels

Labels and comment directives from `solid-labels` 0.x are not supported. A leftover label is a plain JavaScript label, so its code runs once and is not reactive. Replace each one with a compile-time function:

| 0.x                           | 1.0                                   |
| ----------------------------- | ------------------------------------- |
| `signal: x = 0;`              | `let x = $signal(0);`                 |
| `memo: y = x * 2;`            | `const y = $memo(x * 2);`             |
| `effect: { console.log(x); }` | `$effect(() => { console.log(x); });` |
| `mount: { start(); }`         | `$settled(() => { start(); });`       |
| `cleanup: { stop(); }`        | `$cleanup(() => { stop(); });`        |

## Compile-time functions

Some compile-time functions changed with Solid 2.0:

| 0.x                                  | 1.0                                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| `$mount`                             | `$settled`                                                                     |
| `$batch`                             | Removed. Writes are batched by default. Use `$flush` to apply them right away. |
| `$computed`                          | `$memo`, or `$effect`                                                          |
| `$resource`                          | An async `$memo` with `#loading`                                               |
| `$selector`                          | `$projection`                                                                  |
| `$on`                                | `$effect`. Its tracked phase is the list of dependencies.                      |
| `$deferred`, `$observable`, `$from`  | Removed                                                                        |
| `$indexArray`                        | `$mapArray(list, fn, { keyed: false })` or `$repeat`                           |
| `$mutable`, `$produce`               | `$store`. Store setters receive a draft.                                       |
| `$unwrap`                            | `$snapshot`                                                                    |
| `$error`, `$catchError`              | `#try` blocks                                                                  |
| `$startTransition`, `$useTransition` | Removed. Use `$isPending` and `$latest`.                                       |

`$effect` also changed: Solid 2.0 effects have a tracked phase and an untracked phase, and the compiler builds both from one callback. See [Effects](./reactivity.md#effects).

The [`solid-labels` migration guide](https://github.com/lxsmnsyc/solid-labels/blob/1.0/docs/migration.md) has the full list.

## Styles

`solid-styled` is replaced by `<style>` blocks:

```tsx
// Before
css`
  h1 {
    color: ${color()};
  }
`;
```

```html
<!-- After -->
<style>
  h1 {
    color: ${color};
  }
</style>
```

- `@global { }` is gone. Use `:global(...)` or a `<style global>` block.
- `use:solid-styled` is gone.
- `<StyleRegistry>` is not needed. Components add their styles to the head while they are rendered, and on the server the styles go into the head of the document.

See [Styles](./styles.md).
