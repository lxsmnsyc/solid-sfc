const parser = require('./dist/cjs/production');

parser.default(`
<A.B @spread={props} />
`, {
  target: 'dom',
  dev: true,
  hmr: 'esm',
}).then(console.log, console.error);