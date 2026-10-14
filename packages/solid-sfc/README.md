# solid-sfc

> Single-file components for SolidJS.

A `.solid` file holds one component. It has three parts:

- A `<script>` block with the component code. It supports [`solid-labels`](https://github.com/lxsmnsyc/solid-labels).
- `<style>` blocks. They are scoped to the component with [`solid-styled`](https://github.com/lxsmnsyc/solid-styled).
- Markup. It is JSX with a shorter attribute syntax.

```html
<script lang="ts">
  interface Props {
    initial: number;
  }

  const props = $props<Props>();
  let count = $signal(props.initial);
</script>

<style>
  button {
    color: ${count > 10 ? 'red' : 'black'};
  }
</style>

<button onClick=(() => count++)>Count: {count}</button>
```

## Install

```bash
pnpm add solid-js solid-styled
pnpm add -D solid-sfc solid-labels vite vite-plugin-solid @babel/core
```

## Setup

Add the Vite plugin. It includes `vite-plugin-solid`, so do not add that plugin again.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import solidSFC from 'solid-sfc/vite';

export default defineConfig({
  plugins: [solidSFC()],
});
```

Add the types to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["solid-sfc/client"]
  }
}
```

### Options

- `solid` is passed to `vite-plugin-solid`.
- `styled` is passed to `solid-styled`.

## Script

The `<script>` block becomes the body of the component function.

- Imports and type declarations are moved out of the function.
- `$props<T>()` returns the component props. `T` is the props type.
- The `generics` attribute adds type parameters to the component, for example `<script generics="T extends string">`.
- The script cannot export values. Put module-level code in `<script module>` instead. It runs once, and it can export values.

```html
<script module>
  export const MAX = 10;
</script>
```

## Style

Each `<style>` block is scoped to the elements of the component.

- `${expression}` inserts a reactive value. It becomes a CSS variable.
- `<style global>` is not scoped.
- `:global(...)` and `@global { ... }` work as in `solid-styled`.

## Markup

Markup is JSX with these additions.

Identifiers and literals do not need braces:

```html
<button onClick=increment disabled=false tabIndex=0 />
<div id=`item-${id}` items=[1, 2] pattern=/a+/ />
```

Other expressions go in parentheses:

```html
<a href=(base + path) />
```

Braces in an attribute value hold an object:

```html
<div style={ color: 'red' } />
```

`{name}` and `(name)` are shorthands for `name={name}`:

```html
<a {href} />
<a (href) />
```

`[name]` sets an attribute with a computed name:

```html
<div [attribute]=value />
<div [attribute] />
```

Other changes:

- `<!-- comments -->` are removed.
- Void elements such as `<input>` and `<br>` do not need `/>`.
- Children still use `{expression}`.

## Compiler API

`compile` turns a `.solid` file into TSX. The output still uses `solid-labels` and `solid-styled`, so it needs their compilers.

```ts
import { compile } from 'solid-sfc';

const { code, map, hasStyles } = compile(source, { filename: 'Counter.solid' });
```

Syntax errors throw an `SFCError` with `line` and `column`.

## Limitations

- Editors and `tsc` do not type-check `.solid` files yet. Imports of `.solid` files are typed as `Component<any>`.
- Only Vite is supported.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
