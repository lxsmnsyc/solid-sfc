const parser = require('./dist/cjs/production');

















parser.default(`
<solid:property a={a} b={b} {...c} d={d} e={e} />
<solid:self value="Hello World" />
<solid:slot name="value" />
`, {
  target: 'dom',
}).then((result) => console.log(result.code), console.error);