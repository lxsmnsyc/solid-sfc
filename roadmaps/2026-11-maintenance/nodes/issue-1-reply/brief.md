---
id: issue-1-reply
title: Answer and close issue #1 (context in a .solid file)
status: todo
priority: could
type: docs
milestone: 1.0.x
size: S
gate: true
owns:
  - website/docs/components.md
depends_on: []
---

# Answer and close issue #1

## Goal

Issue #1 (2022) asks how to use `createContext` in an SFC; the old compiler did not allow extra exports. The current compiler exports shared values from `<script module>` (`website/docs/components.md`, "Put shared values in `<script module>`"). Verify with a compiled example that a context created in `<script module>` and provided by the component works, add a short docs example if missing, then draft the reply.

## Acceptance

- [ ] A compile test or the docs example shows a context exported from `<script module>`.
- [ ] Reply text in `outcome.md`. The orchestrator posts it and closes #1 only after the user approves.

## Sizing

S: one docs example.
