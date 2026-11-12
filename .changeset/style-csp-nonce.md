---
'solid-sfc': minor
---

Stylesheets added in the browser get a CSP nonce. The nonce comes from the server rendered stylesheets, or from a `<meta property="csp-nonce">` tag. Before, a strict `style-src` blocked the styles of components that were not server rendered.
