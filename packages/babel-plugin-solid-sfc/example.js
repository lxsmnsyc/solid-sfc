const babel = require('@babel/core');
const plugin = require('./dist/cjs/development');

babel.transformAsync(`
'use solid-sfc';

const props = $props();

export default $view(
  <solid:show when={props.visible}>
    <h1>{props.message}</h1>
  </solid:show>
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