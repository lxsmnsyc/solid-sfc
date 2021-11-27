import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.solid");import { template as _$template } from "/node_modules/.vite/solid-js_web.js?v=3d5b3de6";
import { delegateEvents as _$delegateEvents } from "/node_modules/.vite/solid-js_web.js?v=3d5b3de6";
import { insert as _$insert } from "/node_modules/.vite/solid-js_web.js?v=3d5b3de6";
import { createMemo as _createMemo } from "/node_modules/.vite/solid-js.js?v=3d5b3de6";
import { createSignal as _createSignal } from "/node_modules/.vite/solid-js.js?v=3d5b3de6";

const _tmpl$ = _$template(`<div class="flex items-center justify-center space-x-2 text-white p-2 rounded-lg bg-gray-900 bg-opacity-10"><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Increment</button><span></span><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Decrement</button></div>`, 8);

import { esm as _$hot } from "/node_modules/.vite/solid-refresh.js?v=3d5b3de6";
export const $HotComponent = function (props) {
  let [_count, _setcount] = _createSignal(0, {
    name: "count"
  }),
      _message = _createMemo(() => `Count: ${_count()}`, undefined, {
    name: "message"
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

    throw new Error('test');
  }

  return (() => {
    const _el$ = _tmpl$.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.nextSibling,
          _el$4 = _el$3.nextSibling;

    _el$2.$$click = increment;

    _$insert(_el$3, _message);

    _el$4.$$click = decrement;
    return _el$;
  })();
};

const {
  _$handler,
  _$Component
} = _$hot($HotComponent, !!import.meta.hot);

if (import.meta.hot) import.meta.hot.accept(_$handler);
export default _$Component;

_$delegateEvents(["click"]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5zb2xpZCJdLCJuYW1lcyI6WyJjb3VudCIsIm1lc3NhZ2UiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFDQSxNQUFJQSxvQ0FBSixDQUFJQTtBQUFBQTtBQUFBQSxJQUFKO0FBQUEsTUFBd0JDLDZCQUFpQixVQUFBLFFBQXpDLEVBQXdCQTtBQUFBQTtBQUFBQSxJQUF4Qjs7QUFFQSxXQUFBLFNBQUEsR0FBcUI7QUFDbkJEO0FBQUFBOztBQUFBQTs7QUFBQUE7QUFBQUE7QUFDRDs7QUFDRCxXQUFBLFNBQUEsR0FBcUI7QUFDbkJBO0FBQUFBOztBQUFBQTs7QUFBQUE7QUFBQUE7O0FBRUEsVUFBTSxJQUFBLEtBQUEsQ0FBTixNQUFNLENBQU47QUFURjs7Ozs7Ozs7b0JBYUUsUzs7OztvQkFJQSxTIiwic291cmNlc0NvbnRlbnQiOlsiLS0tXG5sZXQgY291bnQgPSAkc2lnbmFsKDApLCBtZXNzYWdlID0gJG1lbW8oYENvdW50OiAke2NvdW50fWApO1xuXG5mdW5jdGlvbiBpbmNyZW1lbnQoKSB7XG4gIGNvdW50Kys7XG59XG5mdW5jdGlvbiBkZWNyZW1lbnQoKSB7XG4gIGNvdW50LS07XG5cbiAgdGhyb3cgbmV3IEVycm9yKCd0ZXN0Jyk7XG59XG4tLS1cbjxkaXYgY2xhc3M9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBzcGFjZS14LTIgdGV4dC13aGl0ZSBwLTIgcm91bmRlZC1sZyBiZy1ncmF5LTkwMCBiZy1vcGFjaXR5LTEwXCI+XG4gIDxidXR0b24gb25DbGljaz17aW5jcmVtZW50fSBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGJnLWdyYXktOTAwIGJnLW9wYWNpdHktMTBcIj5cbiAgICBJbmNyZW1lbnRcbiAgPC9idXR0b24+XG4gIDxzcGFuPnttZXNzYWdlfTwvc3Bhbj5cbiAgPGJ1dHRvbiBvbkNsaWNrPXtkZWNyZW1lbnR9IGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPlxuICAgIERlY3JlbWVudFxuICA8L2J1dHRvbj5cbjwvZGl2PiJdfQ==