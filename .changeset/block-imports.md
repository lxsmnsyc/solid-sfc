---
'solid-sfc': minor
---

Allow imports in the scripts of blocks. The compiler moves them to the top of the module and writes an import that the file already has only once. An imported name stays local to its block: if something else in the file declares the same name, the import and its uses in the block are renamed.
