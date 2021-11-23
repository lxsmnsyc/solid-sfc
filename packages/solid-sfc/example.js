const parser = require('./dist/cjs/production');

parser.default(`
<$:setup>
  let array = [1, 2, 3];
</$:setup>
<$:slot name="example" />
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then(console.log, console.error);