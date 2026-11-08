---
id: examples-idioms
title: Rewrite example code in idiomatic .solid syntax
status: done
priority: should
type: docs
milestone: website
size: M
added: 2026-11-08
verify: pnpm build && pnpm test && pnpm --filter website build && pnpm --filter tasks build && pnpm --filter ssr build
owns:
  - website/src/examples/**
  - website/docs/README.md
  - website/docs/control-flow.md
  - website/docs/getting-started.md
  - website/docs/markup.md
  - website/docs/migration.md
  - website/docs/reactivity.md
  - website/docs/styles.md
  - website/docs/tooling.md
  - examples/tasks/src/**
  - examples/ssr/src/**
  - README.md
  - packages/solid-sfc/README.md
shared:
  - website/docs/components.md
provides: [solid-idioms]
depends_on: []
---

# Rewrite example code in idiomatic .solid syntax

## Goal

Bring every `.solid` sample outside the redesign to the rules in `contracts/solid-idioms.md`: playground examples (`website/src/examples/`), code blocks in `website/docs/*.md` and the READMEs, and the `examples/tasks` and `examples/ssr` apps. Add a short "Writing idiomatic markup" section to `website/docs/markup.md` that states the rules with before and after pairs.

## Context

- User feedback (2026-11-08): samples read like JSX; prop shorthands and needless parentheses are the examples given.
- At planning time: 29 arrow bodies wrapped in needless parentheses, `id=id` in `website/src/examples/Templates.solid:35`, `data=data` in `website/docs/control-flow.md:154`, inline arrows in 20 files.
- `website/docs/components.md` is edited by open PR #10 (Context section). Edit its other samples only, keep the diff small, and expect a rebase.
- The compiler accepts `onClick=(() => open = !open)` and `{id}` (checked on main).
- `website/src/content/` and the home page are out of scope: the redesign rewrites them under the same contract.

## Acceptance

- [ ] No sample left that breaks a rule: grep for `=> (` followed by an assignment, `\b(\w+)=\1\b`, `=(name)` style wrapping, `.map(` and `&&` in markup; list any kept on purpose with the reason.
- [ ] Every playground example still compiles and runs (website build, open each in the playground); `tasks` and `ssr` build; compiler tests unchanged.
- [ ] Docs prose that teaches a form (for example the markup.md attribute table) stays correct.

## Sizing

M: many small edits, verified by builds.
