---
id: fix-scope-48
title: Record references in decorators, namespaces, enums and TS parameter properties
status: todo
priority: should
type: fix
milestone: 1.0.x
size: M
verify: pnpm --filter solid-sfc test
owns:
  - packages/solid-sfc/src/labels/scope.ts
  - packages/solid-sfc/test/labels/**
shared:
  - .changeset/*.md
depends_on:
  - on: fix-scope
    kind: hard
    why: same function bodies in scope.ts
---

# Record references in decorators, namespaces, enums and TS parameter properties

## Goal

Fix solid-labels #48 in both copies: references in decorators, namespace bodies and enum initializers are recorded, `constructor(private p)` declares `p`, and `import fs = require()` declares `fs`. Then close issue #5.

## Context

- Source: issue #5, solid-labels #48 (open, no fix at planning time).
- Fix in solid-sfc first, then open the same change as a PR on `lxsmnsyc/solid-labels` (`1.0`), or port its fix if one landed meanwhile. Link both PRs in the outcome.

## Acceptance

- [ ] A test per construct, failing on the base.
- [ ] Upstream PR opened or upstream fix ported; `labels/CLAUDE.md` sync commit updated.
- [ ] Patch changeset.

## Sizing

M: new fix, two repos.
