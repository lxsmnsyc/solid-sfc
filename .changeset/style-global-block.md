---
'solid-sfc': minor
---

Add `@global { ... }` blocks in scoped `<style>` blocks. Their rules are not scoped. Before, the block was emitted as an unknown at-rule that browsers drop, with its selectors scoped.
