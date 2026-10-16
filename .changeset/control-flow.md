---
'solid-sfc': minor
---

Add control flow blocks to the markup: `#if`, `#for`, `#repeat`, `#switch`, `#try`, `#loading`, `#reveal`, `#portal`, `#no-hydration`, `#hydration` and `#key`.
`#for (item of list by key)` keys the items, and `by index` keeps one entry per position.
`#const name = value;` declares a reactive value at the start of a block.
`#template name(params) { }` declares markup that the file can render with arguments.
A `<script>` at the start of a block runs once each time the block body is created, such as once for each item.
