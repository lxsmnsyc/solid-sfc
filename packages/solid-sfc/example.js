const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  let array = [1, 2, 3, 4];
</solid:setup>
<solid:for each={array}>
  <solid:fragment name="fallback">
    <h1>No items.</h1>
  </solid:fragment>
  {(item) = <h1>{item}</h1>}
</solid:for>
<h1 @spread={props} />
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then(console.log, console.error);