# solid-sfc

> Single-file components for SolidJS.

A `.solid` file holds one component. It has three parts:

- A `<script>` block with the component code. It supports compile-time functions such as `$signal`.
- `<style>` blocks. They are scoped to the component.
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
pnpm add solid-js solid-sfc
pnpm add -D vite vite-plugin-solid
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

## Compile-time functions

Compile-time functions are global functions that the compiler replaces with SolidJS calls. They are based on the compile-time functions of [`solid-labels`](https://github.com/lxsmnsyc/solid-labels/blob/main/docs/ctf.md). They work in `<script>`, `<script module>`, `<style>` interpolations and markup expressions.

### Reactive variables

These functions declare a variable. Reading the variable reads its current value, so the reads are tracked.

```html
<script>
  let count = $signal(0);
  const double = $memo(count * 2);

  function increment() {
    count += 1;
  }
</script>

<button onClick=increment>{count} * 2 = {double}</button>
```

- `$signal(value, options?)` uses `createSignal`. Assigning to the variable calls the setter.
- `$memo(value, options?)` and `$(value)` use `createMemo`.
- `$deferred(value, options?)` uses `createDeferred`.
- `$mapArray(list, fn)` and `$indexArray(list, fn)` use `mapArray` and `indexArray`.
- `$children(value)` uses `children`.
- `$from(observable)` uses `from`.
- `$derefSignal([get, set])` and `$derefMemo(get)` turn an existing signal or accessor into a variable.
- `$destructure(object)` destructures an object into reactive variables. Default values and rest elements are supported.

Only `$signal` and `$derefSignal` variables can be assigned. The others are read-only.

Destructuring `$props()` keeps the props reactive:

```html
<script lang="ts">
  const { label = 'Click', ...rest } = $props<{ label?: string }>();
</script>

<button {...rest}>{label}</button>
```

### References

- `$get(variable)` returns the accessor of a reactive variable.
- `$set(variable)` returns the setter of a signal.
- `$refSignal(variable)` returns `[accessor, setter]`.
- `$refMemo(variable)` returns the accessor.
- `$getter(variable)`, `$setter(variable)` and `$property(variable)` turn an object property into a getter, a setter, or both.

### Other functions

These take a value instead of a function, and the compiler adds the arrow function:

- `$untrack(value)` and `$batch(value)`.
- `$selector(source)`, `$on(deps, fn)`, `$observable(value)` and `$lazy(import('./Component.solid'))`.
- `$root(value)`. A function argument is passed as is.
- `$(expression)` as a statement creates an effect.

These are renamed to the SolidJS function:

- `$effect`, `$computed` and `$renderEffect`.
- `$mount`, `$cleanup`, `$error` and `$catchError`.
- `$merge`, `$uid`, `$createContext`, `$useContext`, `$resource` and `$reaction`.
- `$startTransition`, `$useTransition`, `$owner` and `$runWithOwner`.
- `$store`, `$mutable`, `$produce`, `$reconcile` and `$unwrap` from `solid-js/store`.

`For`, `Show`, `Switch`, `Match`, `Index`, `ErrorBoundary`, `Suspense`, `SuspenseList`, `Dynamic`, `Portal`, `Assets`, `HydrationScript` and `NoHydration` are imported when they are used without an import.

The labels and comments of `solid-labels` are not supported. A label such as `effect:` is a compile error.

## Style

`<style>` blocks only apply to the elements of the component.

- The compiler adds an `s-<hash>` attribute to every native element in the markup. This includes elements passed as children to other components.
- The last part of each selector gets the same attribute. `.list .item` becomes `.list .item[s-<hash>]`.
- `:global(...)` is not scoped. `:global(.dark) .item` matches `.item` inside any `.dark` element.
- `<style global>` is not scoped at all.
- `@keyframes` names are scoped. `animation` and `animation-name` in the same component use the scoped name.
- The styles become a CSS file that Vite bundles. Nothing is added to the page at runtime.

`${expression}` in a declaration value sets a CSS variable. It updates when the expression changes.

```html
<script>
  let size = $signal(16);
</script>

<style>
  p {
    font-size: ${size}px;
  }
</style>
```

The compiler sets the variables in the `style` attribute of each scoped element. An existing `style` attribute is merged with them. Interpolations are not allowed in selectors, at-rules or global styles.

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

`compile` turns a `.solid` file into TSX and CSS. The TSX needs the SolidJS JSX compiler. It imports `solid-sfc/runtime` when a `style` attribute is merged with CSS variables.

```ts
import { compile } from 'solid-sfc';

const { code, map, css } = compile(source, {
  filename: 'Counter.solid',
  // Optional. Must be unique and stable across builds.
  scope: 'counter',
});
// css is { code, map }, or undefined without <style> blocks.
```

Syntax errors throw an `SFCError` with `line` and `column`.

## Limitations

- Editors and `tsc` do not type-check `.solid` files yet. Imports of `.solid` files are typed as `Component<any>`.
- Only Vite is supported.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
