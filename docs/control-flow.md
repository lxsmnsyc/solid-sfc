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
<script lang="ts">
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

- The item is the value from the list. Each item keeps its elements when the list is reordered.
- The index is optional. Solid passes it as an accessor, and the compiler turns it into a reactive variable, so you write `index`, not `index()`.
- The item can be destructured: `#for ({ id, title } of todos)`.
- `#else` renders when the list is empty.

## `#index`

```html
#index (row, i of rows) {
  <input value=row onInput=((event) => update(i, event.currentTarget.value))>
}
```

`#index` compiles to `<For keyed={false}>`. Each position keeps its elements, and the item at that position changes. Solid passes the item as an accessor, and the compiler turns it into a reactive variable, so you write `row`, not `row()`. The index is a plain number. `#index` supports `#else`.

The item of `#index` must be an identifier. It cannot be destructured.

## `#repeat`

```html
#repeat (i of stars) {
  <span>★</span>
} #else {
  <span>No stars</span>
}
```

`#repeat` compiles to `<Repeat count={stars}>`. It renders the body `stars` times, with `i` from `0` to `stars - 1`.

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
} #fallback {
  <p>Loading…</p>
}
```

`#loading` compiles to `<Loading>`. It shows the `#fallback` body while async reads in the body are pending. `#fallback` is optional.

## `#key`

```html
#key (userId) {
  <Profile id=userId />
}
```

`#key` renders its body again when the value changes. Elements and state inside the body are created again. Equal values do not render again.

## Branches

`#else`, `#else if`, `#catch` and `#fallback` must come right after the body of their block. Only whitespace and comments may be in between:

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

- A known keyword follows: `if`, `for`, `index`, `repeat`, `switch`, `try`, `loading` or `key`.
- The keyword is followed by `(` or `{`.
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
