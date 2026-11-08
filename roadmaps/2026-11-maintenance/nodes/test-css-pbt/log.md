# Log: test-css-pbt

- Read roadmap files. fast-check 4.10.2 already in solid-sfc devDependencies.
- minify.pbt: first oracle run passed; adding escapes outside strings found 3 bugs; fixed in `compact`.
- style.pbt: scoping via `compile`. Found leading-space selector-list bug and `1s` rename bug; probes also showed `.a:global(.b)` unscoped and `url(k)` rename (not fixed).
- Extra runs at other seeds (7, 99) with many runs pass.
- PR #20 opened as draft. No Actions triggered.
