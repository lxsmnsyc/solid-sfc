const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  let array = [1, 2, 3];
</solid:setup>
<solid:slot name="example" />
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then(console.log, console.error);