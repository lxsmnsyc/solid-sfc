const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  const [data] = $resource(source, fetchData);

  function example(el) {
    console.log(el);
  }
</solid:setup>
<solid:suspense>
  <solid:fragment name="fallback">
    <h1 use:example>Loading...</h1>
  </solid:fragment>
  <Profile data={data()} />
</solid:suspense>
`, {
  target: 'preserve',
}).then(console.log, console.error);