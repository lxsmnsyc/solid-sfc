# @solid-sfc/tsc

> Type-checks a project that has `.solid` files.

`solid-tsc` runs `tsc` with support for `.solid` files. It takes the same options as `tsc`.

```bash
pnpm add -D @solid-sfc/tsc
```

```json
{
  "scripts": {
    "typecheck": "solid-tsc --noEmit"
  }
}
```

- TypeScript errors in `.solid` files point at the original code.
- Imports of `.solid` files get the real props type of the component.
- Syntax errors in the markup are reported as `error SFC`, and they fail the run.

TypeScript 7 has no JavaScript API, so `solid-tsc` uses its own copy of TypeScript 6. The project can still use TypeScript 7 for everything else.

## License

MIT
