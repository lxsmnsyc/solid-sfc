const babel = require('@babel/core');
const plugin = require('./dist/cjs/development');

babel.transformAsync(`
'use solid-sfc';

const props = $props();

export default $view(
  <solid:suspense>
    <solid:fragment name="fallback">
      <h1>Loading...</h1>
    </solid:fragment>
    <Profile />
  </solid:suspense>
);
`, {
  plugins: [
    [plugin]
  ],
  parserOpts: {
    plugins: [
      'jsx'
    ]
  },
}).then((result) => console.log(result.code), console.error);