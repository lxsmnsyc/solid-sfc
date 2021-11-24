const parser = require('./dist/cjs/production');

parser.default(`
---
let count = 0;
---
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then(console.log, console.error);