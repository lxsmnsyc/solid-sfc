# Tasks example

A task board built with `.solid` files. Each file shows a few features:

| File                                       | Features                                                                                                                                                   |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`App.solid`](./src/App.solid)             | `<style global>`, `$effect`, `#for`, `#switch`, `#if` / `#else`, object literal attribute values, the `{href}` shorthand                                   |
| [`TaskBoard.solid`](./src/TaskBoard.solid) | `$signal`, `$memo`, `$settled`, `$uid`, `ref`, `bind:value`, `#for … by` / `#else`, `#const`, `#if` / `#else if`, the `(percent)` shorthand, void elements |
| [`TaskItem.solid`](./src/TaskItem.solid)   | `$props` destructuring with defaults, `#repeat`, computed attribute names, `@keyframes`, `:global()`, a style interpolation                                |
| [`Progress.solid`](./src/Progress.solid)   | Style interpolations joined with units, such as `${size}px`                                                                                                |
| [`Notes.solid`](./src/Notes.solid)         | `#for … by index`                                                                                                                                          |
| [`QuoteCard.solid`](./src/QuoteCard.solid) | An async `$memo`, `$isPending`, `#try` / `#catch`, `#loading` / `#else`, `#key`                                                                            |

Run it from the root of the repository. `pnpm build` builds the packages that the example uses.

```bash
pnpm install
pnpm build
pnpm --filter tasks dev
```

`pnpm --filter tasks typecheck` checks the types of the `.solid` files with `solid-tsc`.
