---
'solid-sfc': patch
---

Stylesheets are minified unless `dev` is set: `compile()` minifies the stylesheet it writes into the module, and the plugin minifies the stylesheets that it compiles for bundlers other than Vite. Vite minifies its own in production builds.
