# Styles

`<style>` blocks hold CSS that only applies to the elements of the component.

```html
<style>
  .list .item {
    padding: 0.25rem;
  }
</style>

<ul class="list">
  <li class="item">One</li>
</ul>
```

The styles become a CSS file that Vite bundles, so nothing is added to the page at runtime. In development, Vite updates them without reloading the page.

## How scoping works

The compiler adds an `s-<hash>` attribute to every native element in the markup, and adds the same attribute to each selector:

```html
<ul s-x1y2z3 class="list">
  <li s-x1y2z3 class="item">One</li>
</ul>
```

```css
.list .item[s-x1y2z3] {
  padding: 0.25rem;
}
```

- Only the last part of each selector gets the attribute. `.list .item` matches an `.item` of this component inside any `.list`, even one from a parent component.
- The attribute goes before pseudo-elements: `p::before` becomes `p[s-x1y2z3]::before`.
- Rules inside `@media`, `@supports` and other at-rules are scoped too.
- In nested CSS, a part that starts with `&` is not scoped again, because its parent already is: `.a { &:hover { } }` becomes `.a[s-x1y2z3] { &:hover { } }`.
- The hash comes from the path of the file relative to the Vite root, so it is the same on every build.

Elements passed as children to other components get the attribute too, because they are written in this file:

```html
<Card>
  <h2 class="title">Scoped</h2>
</Card>
```

Elements that another component renders itself are not scoped, and the styles of this component do not apply to them.

## Global styles

`:global(...)` removes scoping from part of a selector:

```css
/* Matches .item of this component inside any .dark element. */
:global(.dark) .item {
  color: white;
}

/* Matches every body element. */
:global(body) {
  margin: 0;
}
```

A `<style global>` block is not scoped at all:

```html
<style global>
  body {
    margin: 0;
    font-family: system-ui, sans-serif;
  }
</style>
```

A file can have scoped and global `<style>` blocks together.

## Keyframes

`@keyframes` names in scoped blocks get the hash as a suffix, so animations of different components do not clash. `animation` and `animation-name` declarations in the same component use the new name:

```css
@keyframes fade {
  from { opacity: 0; }
}

.item {
  animation: fade 1s;
}
```

```css
@keyframes fade-x1y2z3 {
  from { opacity: 0; }
}

.item[s-x1y2z3] {
  animation: fade-x1y2z3 1s;
}
```

## Reactive values

`${expression}` in a declaration value inserts a value from the script. It updates when the expression changes.

```html
<script>
  let size = $signal(16);
</script>

<style>
  p {
    font-size: ${size}px;
    color: ${size > 20 ? 'red' : 'inherit'};
  }
</style>

<p>Hello</p>
```

Each interpolation becomes a CSS variable. The compiler sets the variables in the `style` attribute of every scoped element:

```css
p[s-x1y2z3] {
  font-size: var(--s-x1y2z3-0);
  color: var(--s-x1y2z3-1);
}
```

```tsx
const __styleVariables = () => ({
  '--s-x1y2z3-0': `${size()}px`,
  '--s-x1y2z3-1': size() > 20 ? 'red' : 'inherit',
});

<p s-x1y2z3 style={__styleVariables()}>Hello</p>;
```

- Text that touches the interpolation, such as `px` in `${size}px` or `#` in `#${hex}`, becomes part of the variable value. `var()` cannot be joined with other text in CSS.
- A `style` attribute on the element is merged with the variables. Its own values stay.
- Interpolations are only allowed in declaration values. They are not allowed in selectors, at-rules, property names or `<style global>` blocks.
- The expression must not be empty.

## SCSS and Less

`lang="scss"` and `lang="less"` use a preprocessor. Install it in your project, as for any Vite project:

```bash
pnpm add -D sass
```

```html
<style lang="scss">
  $accent: #7c3aed;

  .card {
    border-color: $accent;

    &__title {
      font-size: ${size}px;
    }
  }
</style>
```

The compiler scopes the selectors in the SCSS or Less source, and Vite compiles the result, so Vite's `css.preprocessorOptions` apply.

- The scope attribute goes at the start of each compound, so a suffix like `&__title` joins the parent: `[s-x1y2z3].card__title`.
- Placeholder selectors such as `%shared` are not scoped. The selectors that `@extend` them are.
- Less mixin definitions such as `.mixin()` are not scoped.
- `${expression}` works as in CSS. SCSS and Less `//` comments are comments for interpolations too.
- Every `<style>` block of a file must use the same `lang`.

## Unused selectors

The compiler warns about scoped selectors that no element in the file can match:

```text
[plugin solid-sfc] css-unused-selector: Unused CSS selector ".title" (src/Card.solid:12:3)
```

The editor shows the same warnings.

- Only the scoped part of a selector is checked. In `.list .item`, the compiler checks `.item`, because `.list` can be an element of another component.
- Classes from `class="a b"` and from the keys of `class={ active: on }` are known. A `class` or `id` set by an expression, or a spread such as `{...props}`, can be anything, so every class or id selector matches that element.
- Selectors in `:global(...)` and `<style global>` blocks are not checked, and neither are selectors that a preprocessor builds, such as `.btn-#{$name}`.
- Elements that a child component renders are not scoped, so they never count.

## Syntax errors

CSS syntax errors point at the line and column in the `.solid` file, for example `Unclosed block (App.solid:12:3)`. Errors from the rules above:

| Message                                                 | Cause                                                     |
| ------------------------------------------------------- | --------------------------------------------------------- |
| `Interpolations are only allowed in declaration values` | `${...}` is in a selector, an at-rule or a property name. |
| `A global style cannot have interpolations`             | `${...}` is in a `<style global>` block.                  |
| `Empty interpolation`                                   | `${}` has no expression.                                  |
