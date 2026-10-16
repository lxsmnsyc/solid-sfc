# solid-sfc

> Single-file components for SolidJS 2.0.

A `.solid` file holds one component. It has three parts:

- A `<script>` block with the component code. It supports compile-time functions such as `$signal`.
- `<style>` blocks. They are scoped to the component.
- Markup. It is JSX with a shorter attribute syntax.

```html
<script>
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

## Documentation

- [Getting started](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/getting-started.md)
- [Components](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/components.md)
- [Markup](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/markup.md)
- [Control flow](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/control-flow.md)
- [Reactivity](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/reactivity.md)
- [Styles](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/styles.md)
- [Tooling](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/tooling.md)
- [Migrating from 0.x](https://github.com/lxsmnsyc/solid-sfc/blob/main/website/docs/migration.md)

The sections below are a summary.

## Install

```bash
pnpm add solid-js @solidjs/web solid-sfc
pnpm add -D vite @solidjs/vite-plugin
```

## Setup

Add the Vite plugin. It includes `@solidjs/vite-plugin`, so do not add that plugin again.

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

- `solid` is passed to `@solidjs/vite-plugin`.

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

Compile-time functions are global functions that the compiler replaces with Solid 2.0 calls. They are the compile-time functions of [`solid-labels` 1.0](https://github.com/lxsmnsyc/solid-labels/blob/1.0/docs/ctf.md), and they work in `<script>`, `<script module>`, `<style>` interpolations and markup expressions.

```html
<script>
  let count = $signal(0);
  const double = $memo(count * 2);

  $effect(() => {
    console.log(count, double);
  });

  function increment() {
    count += 1;
  }
</script>

<button onClick=increment>{count} * 2 = {double}</button>
```

- `$signal`, `$memo` and `$` declare reactive variables. Reads become accessor calls, and writes to a signal become setter calls.
- `$effect` and `$renderEffect` take one callback. The compiler builds the tracked compute phase from the variables that the callback reads.
- `$destructure` keeps destructured values reactive. Rest elements use `omit`.
- `$get`, `$set`, `$refSignal`, `$refMemo`, `$derefSignal`, `$derefMemo`, `$getter`, `$setter` and `$property` convert between reactive variables and accessors.
- Other compile-time functions are renamed to the Solid 2.0 function and imported, for example `$settled` to `onSettled` and `$store` to `createStore`.
- `For`, `Show`, `Switch`, `Match`, `Repeat`, `Errored`, `Loading`, `Reveal`, `Dynamic` and `Portal` are imported when they are used without an import.

See the [`solid-labels` documentation](https://github.com/lxsmnsyc/solid-labels/blob/1.0/docs/ctf.md) for the full list.

Destructuring `$props()` keeps the props reactive:

```html
<script>
  const { label = 'Click', ...rest } = $props<{ label?: string }>();
</script>

<button {...rest}>{label}</button>
```

## Control flow

Control flow blocks start with `#` and a keyword. The block body is markup in `{ }`.

```html
#if (user) {
  <p>Hi {user.name}</p>
} #else if (loading) {
  <Spinner />
} #else {
  <Login />
}

#for (item, index of items) {
  <li>{index}: {item.name}</li>
} #else {
  <p>No items</p>
}
```

| Block                                         | Compiles to                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------------- |
| `#if (a) { } #else if (b) { } #else { }`      | A conditional expression. TypeScript narrows the condition inside each branch.  |
| `#for (item, index of list) { } #else { }`    | `<For each={list} fallback>`. `index` is read without a call.                   |
| `#for (item of list by item.id) { }`          | `<For each={list} keyed={(item) => (item.id)}>`. `item` is read without a call. |
| `#for (item, index of list by index) { }`     | `<For each={list} keyed={false}>`. `item` is read without a call.               |
| `#repeat (index of count) { } #else { }`      | `<Repeat count={count} fallback>`. The index is optional: `#repeat (3) { }`.    |
| `#switch { #case (a) { } #default { } }`      | `<Switch>` and `<Match>`. `#default` must be last.                              |
| `#try { } #catch (error, reset) { }`          | `<Errored fallback>`. `error` is read without a call.                           |
| `#loading (on) { } #else { }`                 | `<Loading on fallback>`                                                         |
| `#reveal (order, collapsed) { }`              | `<Reveal order collapsed>`                                                      |
| `#portal (mount) { }`                         | `<Portal mount>`                                                                |
| `#no-hydration { }` and `#hydration (id) { }` | `<NoHydration>` and `<Hydration id>`                                            |
| `#key (value) { }`                            | Renders the body again when `value` changes.                                    |

Blocks can be nested, and they work inside elements and inside JSX in expressions.

`#` only starts a block when it is followed by a keyword and then `(` or `{`, and when it does not come right after a letter or digit. Other text, such as `#hashtag` or `C#`, stays text. Write `{'#'}` to show a `#` that would start a block.

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

Names, literals, member accesses and calls do not need braces:

```html
<button onClick=increment disabled=!valid tabIndex=0 />
<div id=`item-${id}` items=[1, 2] pattern=/a+/ />
<input value=count() title=items[0]?.label />
```

Expressions with operators or whitespace go in parentheses:

```html
<a href=(base + path) />
```

Braces in an attribute value hold an object:

```html
<div style={ color: 'red' } />
```

`{name}` is short for `name={name}`, as in a JavaScript object:

```html
<a {href} />
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

## Editor support

- [VS Code extension](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/vscode): highlighting, type checking, hover, completion and go-to-definition.
- [`@solid-sfc/tsc`](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/tsc): type-checks `.solid` files from the command line with `solid-tsc --noEmit`.
- [`@solid-sfc/language-server`](https://github.com/lxsmnsyc/solid-sfc/tree/main/packages/language-server): the language server, for other editors.

Without these tools, `tsc` types imports of `.solid` files as `Component<any>`.

## Limitations

- Only Vite is supported.

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
