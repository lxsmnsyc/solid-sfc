# Roadmap: 2026-11-maintenance

This folder is a parallel roadmap. `GOAL.md` has the outcome. Each node is a folder under `nodes/`.

Rules for agents working on a node:

- Work only on your own node. Edit files inside your brief's owned paths and your own `nodes/<id>/` folder.
- Do not edit other briefs, `status` fields, contracts or `GOAL.md`. The orchestrator owns them.
- Only dependency nodes edit `package.json` files and `pnpm-lock.yaml`.
- Add a changeset (`.changeset/*.md`) for every user-facing change to a published package.
- Keep notes in your `log.md`. Finish by writing `outcome.md`.
- Read the outcomes of your direct dependencies. Do not read other nodes' logs.
