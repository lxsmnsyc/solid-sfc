# Reactivity

`.solid` files use compile-time functions for reactivity. They are global functions, such as `$signal` and `$memo`, that the compiler replaces with Solid 2.0 calls. They need no import.

They work everywhere in a `.solid` file: in `<script>`, in `<script module>`, in markup expressions and in `<style>` interpolations.

The compile-time functions come from the [`solid-labels` 1.0](https://github.com/lxsmnsyc/solid-labels/blob/1.0/docs/ctf.md) compiler, which `solid-sfc` includes.

## Reactive variables

### `$signal`

`$signal` declares a variable backed by a signal. Reading the variable reads the signal, and assigning to it writes the signal.

```html
<script>
  let count = $signal(0);

  function increment() {
    count += 1;
  }
</script>

<button onClick=increment>{count}</button>
```

```tsx
let [count, setcount_1] = createSignal(0);

function increment() {
  setcount_1((current_1) => (current_1 += 1));
}

<button onClick={increment}>{count()}</button>;
```

- `count = value`, `count += value`, `count++` and the other assignments all become setter calls.
- Assignments that `await` a value are split, so the setter receives the value and not the promise.
- A type annotation on the variable becomes the type argument: `let user: User | null = $signal(null)` compiles to `createSignal<User | null>(null)`.
- The second argument is the signal options, such as `{ equals: false }`.
- For a union of string literals, pass the type as a type argument: `let tab = $signal<Tab>('home')`. With an annotation, TypeScript narrows `tab` to `'home'` outside functions, so a check like `tab === 'settings'` in markup is a type error.

When the initial value is not a constant, or when it reads another reactive variable, the signal is derived. It recomputes from its source until it is written, then keeps the written value.

```html
<script>
  let price = $signal(10);
  let draft = $signal(price * 2);
</script>
```

```tsx
let [price, setprice_1] = createSignal(10);
let [draft, setdraft_1] = createSignal(() => price() * 2);
```

### `$memo` and `$`

`$memo` declares a read-only variable that is computed from other values. `$` is a shorter name for the same thing.

```html
<script>
  let first = $signal('Ada');
  let last = $signal('Lovelace');
  const full = $memo(`${first} ${last}`);
</script>

<p>{full}</p>
```

```tsx
const full = createMemo(() => `${first()} ${last()}`);
```

Assigning to a memo is a compile error: `Cannot assign to derived variable "full"`.

A memo can hold a promise. The variable is the resolved value, and reading it before the promise settles suspends the nearest [`#loading` block](./control-flow.md#loading):

```html
<script lang="ts">
  let id = $signal(1);
  const user = $memo(fetchUser(id));
</script>

#loading {
  <p>{user.name}</p>
  <!-- True while a new user loads and the old one is still shown. -->
  #if ($isPending(() => user)) {
    <p>Updating…</p>
  }
} #fallback {
  <p>Loading…</p>
}
```

Read the memo, and call `$isPending` on it, only inside `#loading`. A read outside it holds the whole update until the promise settles.

### Variables from existing signals

`$derefSignal` and `$derefMemo` turn a signal or an accessor from other code into a reactive variable:

```html
<script>
  let theme = $derefSignal(useTheme());
  const width = $derefMemo(useWindowWidth());

  function toggle() {
    theme = theme === 'dark' ? 'light' : 'dark';
  }
</script>
```

`$derefSignal` expects a `[getter, setter]` pair, and `$derefMemo` expects an accessor.

## Effects

### `$effect`

`$effect` runs a callback when the values it reads change.

```html
<script>
  let count = $signal(0);

  $effect(() => {
    document.title = `Count: ${count}`;
  });
</script>
```

Solid 2.0 effects have two phases: a tracked phase that reads values, and an untracked phase that does the work. The compiler builds both phases from one callback. It finds the reactive variables that the callback reads, reads them in the tracked phase, and passes their values to the callback:

```tsx
createEffect(() => [count()], TimerEffect_1);

function TimerEffect_1([count]) {
  document.title = `Count: ${count}`;
}
```

- Return a function from the callback to clean up. It runs before the next run and when the component is removed.
- The second argument is the effect options, such as `{ defer: true }`.
- The callback takes no parameters, and it cannot be `async`.
- Reads inside `$untrack(...)` do not make the effect run again.

The compiler moves the callback out of the component when it can. It keeps the callback in place when the callback assigns to a plain variable of the component, or uses `this` or `arguments`:

```html
<script>
  let element;
  let count = $signal(0);

  $effect(() => {
    element = render(count);
  });
</script>
```

```tsx
createEffect(() => [count()], ([count]) => {
  element = render(count);
});
```

An effect that only writes a signal runs once, because it reads nothing:

```html
<script>
  let seconds = $signal(0);

  $effect(() => {
    const id = setInterval(() => seconds++, 1000);
    return () => clearInterval(id);
  });
</script>
```

### `$(expression)`

`$` used as a statement is a short effect. The expression is the body of the callback:

```html
<script>
  let count = $signal(0);
  $(console.log('count changed', count));
</script>
```

Use `$effect` when the effect needs a cleanup function.

### Other effects

- `$renderEffect` works like `$effect` and compiles to `createRenderEffect`.
- `$trackedEffect` is `createTrackedEffect`. Its callback is the tracked phase, so it fits effects that read different values each run.

## Props and destructuring

Destructuring `$props()` keeps every prop reactive:

```html
<script lang="ts">
  const { label = 'Save', ...rest } = $props<{ label?: string; disabled?: boolean }>();
</script>

<button {...rest}>{label}</button>
```

```tsx
const def_1 = 'Save',
  label = () => {
    const value_1 = $$props.label;
    return value_1 === void 0 ? def_1 : value_1;
  },
  rest = omit($$props, 'label');
```

`$destructure` does the same for any object:

```html
<script>
  let settings = $signal({ theme: 'dark', layout: { columns: 2 } });
  const { theme, layout: { columns } } = $destructure(settings);
</script>

<p>{theme}, {columns} columns</p>
```

Each name becomes a reactive variable that reads the property when it is used. Nested patterns, default values, computed keys and rest elements are supported. Rest elements use `omit`.

## Passing reactive variables

Reading a reactive variable gives its value. To pass the signal itself to other code, use these functions:

| Function            | Result                              |
| ------------------- | ----------------------------------- |
| `$get(count)`       | The accessor of a signal or a memo. |
| `$set(count)`       | The setter of a signal.             |
| `$refSignal(count)` | `[accessor, setter]`.               |
| `$refMemo(double)`  | The accessor of a memo.             |

```html
<script>
  let count = $signal(0);
</script>

<Counter value=($get(count)) onChange=($set(count)) />
```

`$getter`, `$setter` and `$property` turn an object property into a getter, a setter, or both:

```html
<script>
  let count = $signal(0);
  const state = { count: $property(count) };
</script>
```

```tsx
const state = {
  get count() { return count(); },
  set count(param_1) { setcount_1(() => param_1); },
};
```

## Lists

- `$mapArray(list, (item, index) => value)` maps a list and keeps each result while its item stays in the list. Pass `{ keyed: false }` to map by position instead.
- `$repeat(count, (index) => value)` creates `count` results.

```html
<script>
  let numbers = $signal([1, 2, 3]);
  const squares = $mapArray(numbers, (value) => value * value);
</script>
```

Both declare read-only variables. In markup, the [`#for` and `#repeat` blocks](./control-flow.md) are usually clearer.

## Lifecycle

- `$settled(callback)` runs once the component has rendered and its async work has settled. Return a function to clean up. It replaces `onMount` from Solid 1.x.
- `$cleanup(callback)` runs when the current scope is removed.

```html
<script>
  $settled(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  });
</script>
```

## Async

| Function          | Solid 2.0 function     |
| ----------------- | ---------------------- |
| `$action`         | `action`               |
| `$isPending`      | `isPending`            |
| `$latest`         | `latest`               |
| `$refresh`        | `refresh`              |
| `$affects`        | `affects`              |
| `$flush`          | `flush`                |
| `$resolve(value)` | `resolve(() => value)` |

## Stores

| Function           | Solid 2.0 function      |
| ------------------ | ----------------------- |
| `$store`           | `createStore`           |
| `$projection`      | `createProjection`      |
| `$optimistic`      | `createOptimistic`      |
| `$optimisticStore` | `createOptimisticStore` |
| `$reconcile`       | `reconcile`             |
| `$snapshot`        | `snapshot`              |
| `$deep`            | `deep`                  |

## Other functions

| Function                        | Solid 2.0 function                   | Notes                                  |
| ------------------------------- | ------------------------------------ | -------------------------------------- |
| `$untrack(value)`               | `untrack(() => value)`               |                                        |
| `$root`                         | `createRoot`                         | Pass a function, as with `createRoot`. |
| `$reaction`                     | `createReaction`                     |                                        |
| `$uid()`                        | `createUniqueId()`                   |                                        |
| `$lazy(import('./Page.solid'))` | `lazy(() => import('./Page.solid'))` |                                        |
| `$children(props.children)`     | `children(() => props.children)`     | Declares a read-only variable.         |
| `$merge`                        | `merge`                              |                                        |
| `$omit`                         | `omit`                               |                                        |
| `$createContext`                | `createContext`                      |                                        |
| `$useContext`                   | `useContext`                         |                                        |
| `$owner`                        | `getOwner`                           |                                        |
| `$runWithOwner`                 | `runWithOwner`                       |                                        |

Solid 2.0 batches writes by default, so there is no `$batch`. Use `$flush` to apply queued writes right away.

## Components

These components are imported from Solid when they are used without an import:

- From `solid-js`: `For`, `Show`, `Switch`, `Match`, `Repeat`, `Errored`, `Loading` and `Reveal`.
- From `@solidjs/web`: `Dynamic`, `Portal`, `HydrationScript`, `Hydration` and `NoHydration`.

The `solid:` element names map to the same components: `<solid:show>` is `<Show>`, `<solid:no-hydration>` is `<NoHydration>`, and so on.

## Unsupported syntax

`solid-labels` 0.x also had labels (`effect: { ... }`) and comment directives (`// @signal`). They are not supported. A leftover label is a plain JavaScript label, so its block runs once and is not reactive. Replace it with a compile-time function, such as `$effect`.
