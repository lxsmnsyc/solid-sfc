# Components

A `.solid` file compiles to one component, the default export of the module.

## Parts of a file

```html
<script module>
  export const MAX = 10;
</script>

<script>
  import Button from './Button.solid';

  interface Props {
    initial: number;
  }

  const props = $props<Props>();
  let count = $signal(props.initial);
</script>

<style>
  p {
    color: ${count > MAX ? 'red' : 'black'};
  }
</style>

<p>{count}</p>
<Button onClick=(() => count++) />
```

| Part              | What it is                                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| `<script>`        | The body of the component function. It runs once for each instance of the component. |
| `<script module>` | Code at the top level of the module. It runs once, when the module loads.            |
| `<style>`         | CSS scoped to the component. See [Styles](./styles.md).                              |
| Everything else   | The markup that the component returns. See [Markup](./markup.md).                    |

A file can have at most one `<script>` and one `<script module>`, and any number of `<style>` blocks. The parts can come in any order.

The example compiles to this TSX:

```tsx
import { createSignal as _createSignal } from 'solid-js';

export const MAX = 10;

import Button from './Button.solid';
interface Props {
  initial: number;
}
export default function Counter($$props: Props) {
  const props = $$props;
  let [count, setcount_1] = _createSignal(() => props.initial);

  const __styleVariables = () => ({
    '--s-x1y2z3-0': count() > MAX ? 'red' : 'black',
  });
  return (
    <>
      <p s-x1y2z3 style={__styleVariables()}>{count()}</p>
      <Button onClick={() => setcount_1((current_1) => ++current_1)} />
    </>
  );
}
```

## Component name

The component function is named after the file. `my-button.solid` becomes `MyButton`. A name that would start with a digit gets a `Component` prefix, so `404.solid` becomes `Component404`. The name shows up in stack traces and developer tools.

A component can render itself by its name, which is useful for trees:

```html
<!-- Tree.solid -->
<script>
  interface Node {
    name: string;
    children: Node[];
  }

  const { node } = $props<{ node: Node }>();
</script>

<li>
  {node.name}
  <ul>
    #for (child of node.children) {
      <Tree node=child />
    }
  </ul>
</li>
```

Because the name is taken, the file cannot import or declare anything else with the same name. To wrap a `Button` from a library in `Button.solid`, rename the import:

```html
<script>
  import { Button as BaseButton } from 'ui-library';
</script>
```

## The script

The `<script>` block is always TypeScript, and plain JavaScript works in it unchanged. It needs no `lang` attribute. `lang="ts"` is allowed and changes nothing in the compiler or the editor. Add it if another tool you use needs it to read the script as TypeScript.

The compiler moves these statements out of the component function, to the top of the module:

- Imports.
- Interfaces and type aliases, including `export interface` and `export type`.

Everything else stays in the component function, in order.

The script cannot export values, because it runs once for each instance. Put shared values in `<script module>`:

```html
<script module>
  export const sizes = ['small', 'medium', 'large'] as const;
  export type Size = (typeof sizes)[number];
</script>

<script>
  const props = $props<{ size: Size }>();
</script>
```

The script also cannot have `export default` or `export *`.

## Props

`$props<T>()` returns the props of the component. `T` becomes the type of the props parameter.

```html
<script>
  interface Props {
    label: string;
    disabled?: boolean;
  }

  const props = $props<Props>();
</script>

<button disabled=props.disabled>{props.label}</button>
```

Read props through the object (`props.label`) to keep them reactive. To destructure them, destructure the call itself:

```html
<script>
  const { label, disabled = false, ...rest } = $props<Props>();
</script>

<button {...rest} disabled=(disabled)>{label}</button>
```

Each destructured name becomes a reactive variable that reads the prop when it is used. `disabled` uses its default value when the prop is `undefined`. `rest` holds the remaining props, without `label` and `disabled`.

`$props()` without a type argument types the props as `Record<string, any>`. A component that never calls `$props()` takes no props.

## Generics

The `generics` attribute adds type parameters to the component function:

```html
<script generics="T extends { id: string }">
  import type { Element } from 'solid-js';

  const { items, render } = $props<{ items: T[]; render: (item: T) => Element }>();
</script>

<ul>
  #for (item of items) {
    <li>{render(item)}</li>
  }
</ul>
```

This compiles to `export default function List<T extends { id: string }>($$props: { ... })`.

## Using components

Import a `.solid` file like any other module. The default export is the component.

```tsx
import List from './List.solid';

<List items={users} render={(user) => user.name} />;
```

`.solid` components can also import components from `.tsx` files, and the other way around.
