# Inbox

- Check workflow (lint, typecheck, test on pull requests). Not asked for; CI minutes and workflow changes are the user's call.
- Concise arrow handlers `onClick=(() => count++)` now compile to the long postfix form (temporary variable) since PR #17, because the arrow's value counts as used, as in solid-labels. Event handler return values are ignored, so a later change could treat an update that is the whole body of an `on*` handler as unused and keep the short form. Needs the same change in solid-labels.
