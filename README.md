# solid-sfc

> An experimental SFC compiler for SolidJS

[![NPM](https://img.shields.io/npm/v/solid-sfc.svg)](https://www.npmjs.com/package/solid-sfc) [![JavaScript Style Guide](https://badgen.net/badge/code%20style/airbnb/ff5a5f?icon=airbnb)](https://github.com/airbnb/javascript)

## Install

```bash
npm install solid-sfc
```

```bash
yarn add solid-sfc
```

```bash
pnpm add solid-sfc
```

## Features

## Usage

### Basic example

```xml
<solid:setup>
  let count = $signal(0);
  let message = $memo(`Count: ${count}`);

  effect: {
    console.log(message);
  }
</solid:setup>
<h1>{message}</h1>
```

### Suspense and fragments

```xml
<solid:setup>
  const [data] = $resource(source, fetchData);
</solid:setup>
<solid:suspense>
  <solid:fragment name="fallback">
    <h1>Loading...</h1>
  </solid:fragment>
  <Profile data={data()} />
</solid:suspense>
```

## Syntax

`solid-sfc` follows an HTML format. All tags, except `<solid:setup>` and other Solid-namespaced elements, are included into the components render result.

### `<solid:setup>`

Defines the component's JS code. The code defined is local to the component's function scope (except the import definitions) so you can declare signals and effects in the top-level.

```html
<solid:setup>
  import { createSignal } from 'solid-js';

  const [count, setCount] = createSignal(0);
</solid:setup>
```

You can also use [solid-labels](https://github.com/lxsmnsyc/babel-plugin-solid-labels).

```html
<solid:setup>
  let count = $signal(0);

  effect: {
    console.log(count);
  }
</solid:setup>
```

### Attributes

Attributes, by default, are interpreted as strings. You can use other data types or any kind of valid JS expressions by wrapping the attributes' value with curly braces (quotes are optional). By omitting the value, the attribute is treated as a boolean.

```html
<Example
  stringProp="This is a string property"
  numberProp={Math.PI}
  booleanProp
  someFunction="{() => runCode()}"
  someCall="{thisIsAFunctionCall()}"
/>
```

Local identifiers are inferred from the component's setup code.

```html
<solid:setup>
  import Counter from './Counter';

  let count = $signal(0);
</solid:setup>
<Counter count={count} />
```

### Templating

Much like attributes, you can use curly braces in any part of the `solid-sfc` to evaluate JS expressions.

```html
<solid:setup>
  let count = $signal(0);
</solid:setup>
<h1>Count: {count}</h1>
```

### `<solid:fragment>`, `<solid:slot>` and `<solid:children>`

If a component accepts a property that renders an element, you can use `<solid:fragment>` to render that property's element for the component to receive. `<solid:fragment>` has a single attribute, `name` which is used to define the fragment's key in the props of that component.

```html
<solid:suspense>
  <solid:fragment name="fallback">
    <h1>Loading...</h1>
  </solid:fragment>
  <Profile />
</solid:suspense>
```

Which is equivalent to

```jsx
<Suspense fallback={<h1>Loading</h1>}>
  <Profile />
</Suspense>
```

You can use `<solid:slot>` to render the received fragment on the component's side. `<solid:slot>` also has the `name` attribute to pick from the props.

```html
<!-- Example.solid -->
<solid:slot name="example" />

<!-- ParentExample.solid -->
<solid:setup>
  import Example from './Example.solid';
</solid:setup>
<Example>
  <solid:fragment name="example">
    <h1>Hello World</h1>
  </solid:fragment>
</Example>
```

### Other namespaced elements

- `<solid:for>`: `<For>`
- `<solid:switch>`: `<Switch>`
- `<solid:show>`: `<Show>`
- `<solid:index>`: `<Index>`
- `<solid:error-boundary>`: `<ErrorBoundary>`
- `<solid:suspense>`: `<Suspense>`
- `<solid:suspense-list>`: `<SuspenseList>`
- `<solid:dynamic>`: `<Dynamic>`
- `<solid:portal>`: `<Portal>`
- `<solid:assets>`: `<Assets>`
- `<solid:hydration-script>`: `<HydrationScript>`
- `<solid:no-hydration>`: `<NoHydration>`

## Tooling

SOON

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
