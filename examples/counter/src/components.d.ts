declare module '*.solid' {
  import { JSX } from 'solid-js';
  const Comp: (props: any) => JSX.Element;
  export default Comp;
}
