const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  let array = [1, 2, 3];
</solid:setup>
<solid:for each={array}>
  {(item) => <h1>Count: {item}</h1>}
</solid:for>
`, {
  target: 'ssr',
}).then(console.log, console.error);