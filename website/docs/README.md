# solid-sfc documentation

`solid-sfc` compiles `.solid` single-file components for SolidJS 2.0. A `.solid` file holds one component: a script, scoped styles and markup.

```html
<script>
  const { initial = 0 } = $props<{ initial?: number }>();
  let count = $signal(initial);
</script>

<style>
  button {
    font-weight: ${count > 9 ? 'bold' : 'normal'};
  }
</style>

<button onClick=(() => count++)>
  Clicked {count} times
</button>

#if (count > 9) {
  <p>That's a lot of clicks.</p>
}
```

## Guides

1. [Getting started](./getting-started.md): install the packages and write a first component.
2. [Components](./components.md): the parts of a `.solid` file, props, generics and module code.
3. [Markup](./markup.md): the JSX syntax that `.solid` files use.
4. [Control flow](./control-flow.md): `#if`, `#for` and the other blocks.
5. [Reactivity](./reactivity.md): `$signal`, `$memo`, `$effect` and the other compile-time functions.
6. [Styles](./styles.md): scoped styles and reactive CSS values.
7. [Tooling](./tooling.md): type checking, editors, bundler plugins and the compiler API.
8. [Migrating from 0.x](./migration.md): moving from `babel-plugin-solid-sfc`.
