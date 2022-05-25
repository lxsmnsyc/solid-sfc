import * as solid from 'solid-js';
import * as solidWeb from 'solid-js/web';

declare global {
  function $props<T>(): T;
  function $view<T>(value: solid.JSX.Element): solid.Component<T>
}

type Props<T> = T extends (props: infer P) => solid.JSX.Element
  ? P
  : never;

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'solid:fragment': { name: string, children: solid.JSX.Element };
      'solid:slot': { name: string };
      'solid:children': unknown;
      'solid:self': unknown;

      'solid:for': Props<typeof solid.For>;
      'solid:switch': Props<typeof solid.Switch>;
      'solid:match': Props<typeof solid.Match>;
      'solid:show': Props<typeof solid.Show>;
      'solid:index': Props<typeof solid.Index>;
      'solid:error-boundary': Props<typeof solid.ErrorBoundary>;
      'solid:suspense': Props<typeof solid.Suspense>;
      'solid:suspense-list': Props<typeof solid.SuspenseList>;

      'solid:dynamic': Props<typeof solidWeb.Dynamic>;
      'solid:portal': Props<typeof solidWeb.Portal>;
      'solid:assets': Props<typeof solidWeb.Assets>;
      'solid:hydration-script': Props<typeof solidWeb.HydrationScript>;
      'solid:no-hydration': Props<typeof solidWeb.NoHydration>;
    }
  }
}
