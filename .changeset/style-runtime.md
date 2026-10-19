---
'solid-sfc': minor
---

Styles are added to the page while their component is rendered, as in solid-styled. The first instance of a component adds a `<style>` to the head through `useStyle` from `solid-sfc/runtime`, and the last one to be removed removes it, so a page only loads the CSS of the components it shows. On the server, the stylesheet goes into the head of the document with `useHead`, which also fixes server-rendered pages in start mode having no styles until scripts ran. The bundler still processes the CSS: Vite through `?inline`, and the other bundlers through a JavaScript module that the plugin compiles, with `sass` or `less` for SCSS and Less. The builds write no `.css` files for components.
