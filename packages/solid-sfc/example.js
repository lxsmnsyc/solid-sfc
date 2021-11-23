const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  import Counter from './Counter';

  let count = $signal(0);
</solid:setup>
<Counter count={count}>
  <solid:spread from="props" />
</Counter>
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then((result) => {
  console.log(result.map);
  console.log(result.code + '\n//# sourceMappingURL=data:application/json;base64,' + btoa(JSON.stringify(result.map)))
}, console.error);