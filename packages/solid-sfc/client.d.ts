/// <reference path="./globals.d.ts" />

declare module '*.solid' {
  const component: import('solid-js').Component<any>;
  export default component;
}
