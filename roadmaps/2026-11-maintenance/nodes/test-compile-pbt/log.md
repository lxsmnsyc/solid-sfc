# Log: test-compile-pbt

- Reset worktree to origin/main, branch `test/compile-pbt`. fast-check ^4.10.2 was already in `solid-sfc` devDependencies on main.
- First grammar was too big (25 ms per compile, 45 s). Cut nesting to depth 2 and 2-3 children, cached compile by source: suite 0.8 s.
- First run of the properties passed with zero findings. Probed the accepted rate: grammar bugs of mine (text `5 > 3`, escaped quotes in attribute strings, templates inside elements, text glued to `#if`, repeated `let` names, interpolations in `<style global>`). Fixed until 18000 files compile.
- Bugs found by hand-probing rejected valid files, shrunk with fc.check: `//` comment in header (finding 2), `findWord` and comments/regex (finding 1), dynamic tag at EOF (finding 3).
- Raw `Error` from postcss-selector-parser (finding 4) was found with 3 chained edits; random single edits rarely hit a selector, so the finding has a targeted property.
- Lint: `expect-expect` does not see assertions in a helper, so tests call `expect(report(property)).toBe('')`.
- Pushed, draft PR #21. Repo is public, so no Actions concern; no workflow was triggered.
