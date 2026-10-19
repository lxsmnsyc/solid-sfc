---
'solid-sfc': minor
'@solid-sfc/language-core': minor
---

Support markup in scripts. Elements in `<script>`, `<script module>` and the scripts of blocks use the markup syntax, such as `const icon = <Icon size=16 {label} />`, and are scoped like the rest of the markup. As in a `.tsx` file, type parameters of arrow functions are written as `<T,>`. The outline and the fallback script of the editor mask the markup, so scripts with markup still list their declarations.
