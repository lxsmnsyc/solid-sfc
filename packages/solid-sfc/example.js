const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  const [data] = $resource(source, fetchData);
</solid:setup>
<solid:suspense>
  <solid:fragment name="fallback">
    <h1>Loading...</h1>
  </solid:fragment>
  <Profile data={data()} />
</solid:suspense>
`).then(console.log, console.error);