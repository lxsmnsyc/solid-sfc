/// <reference types="solid-labels" />

declare module '*.solid' {
  import type { Component } from 'solid-js';

  const component: Component<any>;
  export default component;
}

/** Returns the props of the component. Only valid in a `.solid` file. */
declare function $props<T = Record<string, any>>(): T;
