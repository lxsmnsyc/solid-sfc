---
id: website-redesign
title: Redesign the website
status: todo
priority: should
type: story
milestone: website
outline: true
size: XL
gate: true
depends_on:
  - on: og-tags
    kind: hard
    why: same index.html head; og image is redone in the new style
---

# Redesign the website

## Goal

New visual design for `website/` (home, docs, playground, preview frame): layout, typography, color in light and dark, navigation, code blocks, playground panes. Refine into children after the user picks a direction: likely a design-tokens and layout child, then home, docs and playground children in parallel, then the og image.

## Context

- Current: `website/src/pages/{Home,Docs,Playground}.solid`, `theme.css` imports GitHub highlight themes, docs from `website/docs/*.md` via markdown-it, Terracotta in the playground.
- Open question: design direction (references, brand, must keep or drop parts).
