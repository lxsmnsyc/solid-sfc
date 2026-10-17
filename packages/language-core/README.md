# @solid-sfc/language-core

> The [Volar](https://volarjs.dev) language plugin for `solid-sfc` `.solid` files.

Editor and type-checking tools use this package to understand `.solid` files. It turns each file into virtual code:

- `tsx` is the compiled component, before compile-time functions are replaced. It maps back to the file, so TypeScript errors, hover and completion point at the original code.
- `style_0`, `style_1` and so on are the `<style>` blocks as CSS, SCSS or Less documents, by their `lang`.

When the markup has a syntax error, the broken part is blanked and the file is compiled again. When that fails, the `tsx` code only contains the scripts, so the scripts still get type information.

```ts
import { createSolidLanguagePlugin } from '@solid-sfc/language-core';

const plugin = createSolidLanguagePlugin({
  onError(fileName, error) {
    console.error(fileName, error.message);
  },
});
```

## License

MIT
