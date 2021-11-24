import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.solid");import { template as _$template } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { delegateEvents as _$delegateEvents } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { insert as _$insert } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { memo as _$memo } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { createSignal as _createSignal } from "/node_modules/.vite/solid-js.js?v=3923be10";

const _tmpl$ = _$template(`<div class="flex items-center justify-center space-x-2 text-white p-2 rounded-lg bg-gray-900 bg-opacity-10"><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Increment</button><span>Count: </span><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Decrement</button></div>`, 8);

import { esm as _$hot } from "/node_modules/.vite/solid-refresh.js?v=3923be10";
export const $HotComponent = function (props) {
  let [_count, _setcount] = _createSignal(0, {
    name: "count"
  });

  function increment() {
    (() => {
      const _current = _count();

      _setcount(() => _current + 1);

      return _current;
    })();
  }

  function decrement() {
    (() => {
      const _current2 = _count();

      _setcount(() => _current2 - 1);

      return _current2;
    })();
  }

  return _$memo(() => {
    return (() => {
      const _el$ = _tmpl$.cloneNode(true),
            _el$2 = _el$.firstChild,
            _el$3 = _el$2.nextSibling,
            _el$4 = _el$3.firstChild,
            _el$5 = _el$3.nextSibling;

      _el$2.$$click = increment;

      _$insert(_el$3, _count, null);

      _el$5.$$click = decrement;
      return _el$;
    })();
  });
};

const {
  _$handler,
  _$Component
} = _$hot($HotComponent, !!import.meta.hot);

if (import.meta.hot) import.meta.hot.accept(_$handler);
export default _$Component;

_$delegateEvents(["click"]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5zb2xpZCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQVVBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTs7QUFBQSxzQkFDRSxTQURGOztBQUFBOztBQUFBLHNCQUtFLFNBTEY7QUFBQTtBQUFBIiwic291cmNlc0NvbnRlbnQiOlsiLS0tXG5sZXQgY291bnQgPSAkc2lnbmFsKDApO1xuXG5mdW5jdGlvbiBpbmNyZW1lbnQoKSB7XG4gIGNvdW50Kys7XG59XG5mdW5jdGlvbiBkZWNyZW1lbnQoKSB7XG4gIGNvdW50LS07XG59XG4tLS1cbjxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBzcGFjZS14LTIgdGV4dC13aGl0ZSBwLTIgcm91bmRlZC1sZyBiZy1ncmF5LTkwMCBiZy1vcGFjaXR5LTEwXCI+XG4gIDxidXR0b24gb25DbGljaz17aW5jcmVtZW50fSBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGJnLWdyYXktOTAwIGJnLW9wYWNpdHktMTBcIj5cbiAgICBJbmNyZW1lbnRcbiAgPC9idXR0b24+XG4gIDxzcGFuPkNvdW50OiB7Y291bnR9PC9zcGFuPlxuICA8YnV0dG9uIG9uQ2xpY2s9e2RlY3JlbWVudH0gY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBiZy1ncmF5LTkwMCBiZy1vcGFjaXR5LTEwXCI+XG4gICAgRGVjcmVtZW50XG4gIDwvYnV0dG9uPlxuPC9kaXY+Il19