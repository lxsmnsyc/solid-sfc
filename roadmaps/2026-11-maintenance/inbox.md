# Inbox

- Check workflow (lint, typecheck, test on pull requests). Not asked for; CI minutes and workflow changes are the user's call.
- Concise arrow handlers `onClick=(() => count++)` now compile to the long postfix form (temporary variable) since PR #17, because the arrow's value counts as used, as in solid-labels. Event handler return values are ignored, so a later change could treat an update that is the whole body of an `on*` handler as unused and keep the short form. Needs the same change in solid-labels.
- `src/labels/reactive.ts` is behind solid-labels #63 (writes through TS wrappers, merged upstream after PR #60). Found by the PR #22 review. Check what #63 adds beyond the TS_WRAPPERS port in fix-scope, and port it if it changes behavior.
- Vercel hit its deployment rate limit on PR #22. PR #14 (deploy only from main when the site changed) stops the per-branch builds.
- `packages/*/.vitest/` (vitest output) shows up untracked and in `oxfmt --check`; add it to `.gitignore`. Found by test-editor-mbt.
