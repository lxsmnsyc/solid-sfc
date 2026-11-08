---
name: scope-analyze
version: 1
status: frozen
defined_by: fix-scope
---

# Contract: scope-analyze

## Purpose

The scope analysis API in `packages/solid-sfc/src/labels/scope.ts`. fix-scope and fix-scope-48 change its results, not its shape. test-scope-oracle reads it.

## Interface

The existing exports at `1ca2128`: `analyze(program)`, `Ref` (`node`, `mode: 'read' | 'write' | 'readwrite'`, `parents`, `binding`, `shorthand?`, `exported?`), `Binding` (`name`, `kind`, `node`, `scope`, `refs`), `Scope`. See the top of the file.

## Behavior

- Every identifier reference gets one `Ref`; `binding` is `null` for globals.
- perf-scope may drop or make lazy the `parents` field only through a change request, because the labels transforms read it.

## Changes

- v1: frozen as the existing API.
