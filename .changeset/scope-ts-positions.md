---
'solid-sfc': patch
---

Fix scope analysis: references in decorators, namespace bodies and enum initializers are recorded, `constructor(private p)` declares `p`, and `import fs = require("fs")` declares `fs`.
