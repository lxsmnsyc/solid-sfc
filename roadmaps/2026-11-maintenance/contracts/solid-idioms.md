---
name: solid-idioms
version: 1
status: frozen
defined_by: examples-idioms
---

# Contract: solid-idioms

## Purpose

How `.solid` code is written in every example, doc sample, playground example, home demo and image on the site. The user found the samples written like JSX (2026-11-08). `.solid` markup is not JSX: samples must show the language's own forms. Every node that writes `.solid` code follows this.

## Rules

1. **Shorthand when the name matches.** `id=id` is `{id}`, `data=data` is `{data}`, `href=href` is `{href}`.
2. **Bare values need no wrapping.** `value=count`, `onClick=toggle`, `label=item.name`, `disabled=!valid`. Never `value=(count)`. Never `value={count}`: braces are an object literal.
3. **No parentheses an expression does not need.** An arrow body that assigns is written bare: `onClick=(() => open = !open)`, `onInput=((event) => name = event.currentTarget.value)`, not `(() => (open = !open))`. The outer parentheses around an attribute arrow stay; the compiler needs them.
4. **Name the handler when it does more than one assignment**, in `<script>`, and pass it bare: `onClick=addTask`.
5. **Control flow blocks, not JSX patterns.** `#if`, `#for`, `#switch`, `#loading`, `#try` instead of `&&`, ternaries and `.map()` in markup.
6. **Reactive variables, not accessors.** `$signal`, `$memo`, `$props` and assignment; no `createSignal` and setter calls unless the sample is about them.
7. **`class={ active: selected }`** for conditional classes, not template strings.
8. **Void elements without `/>`**: `<input value=name>`, `<br>`.
9. Script code follows the repo's formatter style (single quotes); markup follows these rules even where a JS formatter would add parentheses.

## Changes

- v1: initial, from user feedback.
