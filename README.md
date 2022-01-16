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

## Usage

### Basic example

```jsx
// Required for files that do not end in `.solid.(t|j)sx?`
'use solid-sfc';

import { createSignal, createMemo, createEffect } from 'solid-js';

const [count, setCount] = createSignal(0);
const message = createMemo(() => `Count: ${count()}`);

createEffect(() => {
  console.log(message());
});

// Export default is synonymous to "return".
export default <h1>{message()}</h1>;
```

### Suspense and fragments

```jsx
const [data] = createResource(source, fetchData);
export default (
  <solid:suspense>
    <solid:fragment name="fallback">
      <h1>Loading...</h1>
    </solid:fragment>
    <Profile data={data()} />
  </solid:suspense>
);
```

### `<solid:fragment>`, `<solid:slot>` and `<solid:children>`

If a component accepts a property that renders an element, you can use `<solid:fragment>` to render that property's element for the component to receive. `<solid:fragment>` has a single attribute, `name` which is used to define the fragment's key in the props of that component.

```jsx
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

```jsx
/* Example.solid */
export default <solid:slot name="example" />

/* ParentExample.solid */
import Example from './Example.solid';

export default (
  <Example>
    <solid:fragment name="example">
      <h1>Hello World</h1>
    </solid:fragment>
  </Example>
);
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

### TypeScript

```ts
/// <reference types="solid-sfc" />
```

## License

MIT © [lxsmnsyc](https://github.com/lxsmnsyc)
