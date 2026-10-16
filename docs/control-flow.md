# Control flow

Control flow blocks render markup conditionally or in a loop. A block is `#`, a keyword, an optional header in `( )`, and a body of markup in `{ }`.

```html
#if (user) {
  <p>Hi {user.name}</p>
} #else {
  <button onClick=login>Log in</button>
}
```

Blocks can be nested. They work at the top level of the markup, inside elements, and inside JSX in expressions.

## `#if`

```html
#if (status === 'loading') {
  <Spinner />
} #else if (status === 'error') {
  <p>Something went wrong.</p>
} #else {
  <Results />
}
```

`#if` compiles to a conditional expression:

```tsx
{(status === 'loading') ? <><Spinner /></>
  : (status === 'error') ? <><p>Something went wrong.</p></>
  : <><Results /></>}
```

Solid tracks the condition, so the block updates when it changes. TypeScript narrows values inside each branch:

```html
<script>
  const { user } = $props<{ user: { name: string } | null }>();
</script>

#if (user) {
  <p>{user.name}</p>
}
```

Without `#else`, the block renders nothing when the condition is false.

## `#for`

```html
<ul>
  #for (todo, index of todos) {
    <li>{index + 1}. {todo.title}</li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
```

`#for` compiles to `<For>`:

```tsx
<For each={todos} fallback={<><li>Nothing to do.</li></>}>
  {(todo, __index) => {
    const index = $derefMemo(__index);
    return <><li>{index + 1}. {todo.title}</li></>;
  }}
</For>
```

- The item is the value from the list.
- The index is optional. Solid passes it as an accessor, and the compiler turns it into a reactive variable, so you write `index`, not `index()`.
- The item can be destructured: `#for ({ id, title } of todos)`.
- `#else` renders when the list is empty.

### Keys

By default, each item keeps its elements while the same value is in the list, so reordering moves the elements. When an item is replaced with a new object, its elements are created again. `by` sets what identifies an item instead:

```html
#for (todo of todos by todo.id) {
  <li>{todo.title}</li>
}
```

`by todo.id` compiles to `keyed={(todo) => (todo.id)}`. An item keeps its elements while an item with the same key is in the list, even when the item is a new object. The item can change, so Solid passes it as an accessor, and the compiler turns it into a reactive variable. You still write `todo.title`.

`by index` keeps one set of elements per position. The item at each position can change, and the index is a plain number:

```html
#for (row, i of rows by index) {
  <input value=row onInput=((event) => update(i, event.currentTarget.value))>
}
```

`by index` compiles to `keyed={false}`. `by` followed by the name of the index, such as `by i`, does the same.

| Header                   | Elements are kept for | `item`              | `i`                 |
| ------------------------ | --------------------- | ------------------- | ------------------- |
| `(item, i of list)`      | Each value            | A value             | A reactive variable |
| `(item, i of list by k)` | Each key              | A reactive variable | A reactive variable |
| `(item, i of list by i)` | Each position         | A reactive variable | A number            |

## `#repeat`

```html
#repeat (i of stars) {
  <span>★</span>
} #else {
  <span>No stars</span>
}
```

`#repeat` compiles to `<Repeat count={stars}>`. It renders the body `stars` times, with `i` from `0` to `stars - 1`.

The index is optional:

```html
#repeat (3) {
  <span>★</span>
}
```

## `#switch`

```html
#switch {
  #case (status === 'ok') {
    <Ok />
  }
  #case (status === 'error') {
    <Error />
  }
  #default {
    <Idle />
  }
}
```

`#switch` compiles to `<Switch>` and one `<Match>` for each `#case`. It renders the first case whose condition is true. `#default` renders when no case matches, and it must be the last branch.

Only `#case`, `#default`, whitespace and comments are allowed directly inside `#switch`.

## `#try`

```html
#try {
  <Chart data=data />
} #catch (error, reset) {
  <p>{String(error)}</p>
  <button onClick=reset>Try again</button>
}
```

`#try` compiles to `<Errored>`. If the body throws while rendering, the `#catch` body renders instead.

- `error` is the thrown value. Solid passes it as an accessor, and the compiler turns it into a reactive variable.
- `reset` renders the body again.
- Both parameters are optional: `#catch (error)` and `#catch` also work.

`#try` needs a `#catch`.

## `#loading`

```html
#loading {
  <Profile id=userId />
} #else {
  <p>Loading…</p>
}
```

`#loading` compiles to `<Loading>`. It shows the `#else` body while async reads in the body are pending. `#else` is optional.

After the first load, `#loading` keeps showing the old content while new data loads. A header shows the fallback again whenever its value changes:

```html
#loading (userId) {
  <Profile id=userId />
} #else {
  <p>Loading…</p>
}
```

The header compiles to the `on` prop of `<Loading>`.

## `#reveal`

```html
#reveal ('sequential') {
  #loading { <Profile /> } #else { <p>Loading profile…</p> }
  #loading { <Feed /> } #else { <p>Loading feed…</p> }
}
```

`#reveal` compiles to `<Reveal>`. It controls when the `#loading` blocks inside it show their content:

- `'sequential'`, the default, shows them in order. A block waits for the blocks before it.
- `'together'` shows them all at once, when every one has loaded.
- `'natural'` shows each one as soon as it loads. It is useful inside another `#reveal`, where the whole group counts as one block.

The header is `(order)` or `(order, collapsed)`, and both are optional. With `collapsed` set to `true` in sequential order, the blocks after the next one to load show nothing instead of their fallbacks.

## `#portal`

```html
#portal {
  <dialog open>Saved</dialog>
}
```

`#portal` compiles to `<Portal>`. It renders its body at the end of `document.body`, outside the parent elements. A header sets another target: `#portal (container) { }`.

## `#no-hydration` and `#hydration`

```html
#no-hydration {
  <ClientOnlyMap />
}
```

`#no-hydration` compiles to `<NoHydration>`. The server renders the body as static HTML without hydration markers. The client skips the body while it hydrates the page, then renders it once hydration ends. Use it for parts that only work in the browser.

`#hydration` compiles to `<Hydration>`. It turns hydration back on for a part of a `#no-hydration` body. Its header is an optional id:

```html
#no-hydration {
  <Shell>
    #hydration ('sidebar') {
      <Sidebar />
    }
  </Shell>
}
```

## `#key`

```html
#key (userId) {
  <Profile id=userId />
}
```

`#key` renders its body again when the value changes. Elements and state inside the body are created again. Equal values do not render again.

## Scripts in blocks

A `<script>` at the start of a block runs each time the block body is created: once for each item of `#for`, or each time an `#if` branch is shown. Its variables are visible in the markup of the block.

```html
#for (item of items by item.id) {
  <script>
    let open = $signal(false);
    const size = $memo(item.name.length);

    function toggle() {
      open = !open;
    }
  </script>
  <button onClick=toggle>{item.name} ({size})</button>
  #if (open) {
    <Details {item} />
  }
}
```

Each item gets its own `open` signal, and an `$effect` in the script is removed with its item.

- The script comes first in the block, before the markup. Only whitespace, comments and `#template` declarations may come before it.
- `const total = $memo(item.price * item.quantity);` declares a value that updates with the item.
- It takes no attributes. It uses the same language as the rest of the file.
- It cannot import modules or call `$props()`. Those belong in the component script at the top of the file.
- It works in every block body, including `#else`, `#catch` and `#template` bodies.
- A `<script>` inside an element is an error.

The editor treats a `<script>` at the start of a line as the component script, and an indented one as the script of a block.

## `#template`

`#template` declares markup that the file can render with arguments, like a function:

```html
<table>
  #for (user, index of users by user.id) {
    {row(user, index)}
  }
</table>

#template row(user: User, index: number) {
  <tr>
    <td>{index + 1}</td>
    <td>{user.name}</td>
  </tr>
}
```

`#template row(user, index) { … }` compiles to `const row = (user, index) => <>…</>;`. Call it in an expression, `{row(user, 0)}`, or pass it to a component that renders it, `<Table renderRow=row />`.

- A template at the top level can be used anywhere in the file, before or after it. The compiler moves it before the markup.
- In a block, a template is a declaration, like a script. It comes before the markup of the block and can read the values of the block.
- The parameters are TypeScript parameters, with types and default values.
- A template can have its own `<script>`, and its markup gets the scoped styles of the file.
- `{row(user, index)}` renders again when an argument it reads changes, such as `index`.

## Branches

`#else`, `#else if` and `#catch` must come right after the body of their block. Only whitespace and comments may be in between:

```html
#if (a) {
  <A />
}
<!-- The second branch. -->
#else {
  <B />
}
```

## `#` in text

`#` starts a block only when all of these are true:

- A known keyword follows: `if`, `for`, `repeat`, `switch`, `try`, `loading`, `reveal`, `portal`, `hydration`, `no-hydration`, `key` or `template`. Keywords with more than one word join them with `-`.
- The keyword is followed by `(` or `{`. `#template` is followed by a name and `(` instead.
- The `#` does not come right after a letter, a digit, `_` or `$`.

Any other `#` is text, so `C#`, `#hashtag` and `#if without parentheses` render as written. To render text that looks like a block, write the `#` as an expression:

```html
<code>{'#'}if (x) {'{'} {'}'}</code>
```

## Syntax errors

| Message                                                       | Cause                                                                      |
| ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `Expected "}" to close the block`                             | A block body is not closed, or a closing tag inside it has no opening tag. |
| `Expected an expression after #if`                            | The header is empty, as in `#if ()`.                                       |
| `Expected "{" after #if`                                      | The body is missing.                                                       |
| `#else must follow its block`                                 | A branch has no block before it.                                           |
| `Expected "item of list" or "item, index of list" after #for` | The loop header has no `of`, or more than two names.                       |
| `#default must be the last branch of #switch`                 | A `#case` comes after `#default`.                                          |
| `#try needs a #catch block`                                   | `#try` has no `#catch`.                                                    |
