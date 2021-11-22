const parser = require('./dist/cjs/production');

parser.default(`
<solid:setup>
  const [data] = $resource(source, fetchData);
  console.log('Hello World');
</solid:setup>
<solid:render>
  <solid:suspense>
    <solid:slot name="fallback">
      <h1>Loading...</h1>
    </solid:slot>
    <Profile data={data()} />
    {data()}
  </solid:suspense>
</solid:render>
`).then(console.log, console.error);