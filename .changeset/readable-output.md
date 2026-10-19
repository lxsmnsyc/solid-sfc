---
'solid-sfc': minor
---

The compiled module is laid out like code written by hand. Imports come first, one statement for each module. The script is indented in the component function, the markup in its `return`, and blank lines are kept to one. Setters are named like `setCount`, generated names only get a number when they would clash, and `onClick=(handler)` compiles to `onClick={handler}`. Declarations at the start of a `#for` or `#template` body go in its function, and comments on lines of their own leave no blank line.
