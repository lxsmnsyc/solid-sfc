---
'solid-sfc': patch
---

Fix a dynamic tag that closes at the very end of the file, with no newline after it. The component compiled to TSX with a syntax error.
