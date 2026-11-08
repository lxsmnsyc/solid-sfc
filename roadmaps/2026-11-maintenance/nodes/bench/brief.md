---
id: bench
title: Compile benchmark with a baseline
status: todo
priority: should
type: feature
milestone: quality
size: S
exclusive: [bench]
owns:
  - benchmarks/**
  - pnpm-workspace.yaml
depends_on:
  - on: deps-solid-rc
    kind: hard
    why: baseline must be taken on the final dependency versions
---

# Compile benchmark with a baseline

## Goal

Add `benchmarks/compile` that times `compile()` on every `.solid` file in `examples/` and `packages/solid-sfc/test/fixtures`, plus one large generated file, and reports per-phase cost (scan, script/labels, template, style). Record the baseline in `benchmarks/compile/BASELINE.md` with commit and machine.

## Context

Use perf-pass's `bench.py` method: warmup, repeated runs, report median and noise.

## Acceptance

- [ ] `pnpm --filter benchmarks compile` (or `node benchmarks/compile/run.ts`) prints medians and noise.
- [ ] A CPU profile of the large file is saved and its top 10 self-time functions are in BASELINE.md.

## Sizing

S.

## Notes for the worker

- Adding a workspace package may change `pnpm-lock.yaml`; if so take it, no other node is editing it at this point.
