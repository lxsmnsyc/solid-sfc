import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.solid");import { template as _$template } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { delegateEvents as _$delegateEvents } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { insert as _$insert } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { memo as _$memo } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { createSignal as _createSignal } from "/node_modules/.vite/solid-js.js?v=3923be10";

const _tmpl$ = _$template(`<div class="flex items-center justify-center space-x-2 text-white p-2 rounded-lg bg-gray-900 bg-opacity-10"> <button class="p-2 rounded-lg bg-gray-900 bg-opacity-10"> Increment </button> <span>Count: </span> <button class="p-2 rounded-lg bg-gray-900 bg-opacity-10"> Decrement </button></div>`, 8);

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
            _el$4 = _el$3.nextSibling,
            _el$5 = _el$4.nextSibling,
            _el$6 = _el$5.firstChild,
            _el$7 = _el$5.nextSibling,
            _el$8 = _el$7.nextSibling;

      _el$3.$$click = increment;

      _$insert(_el$5, _count, null);

      _el$8.$$click = decrement;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5zb2xpZC5zZXR1cC4xIiwiQXBwLnNvbGlkLnJlbmRlci4yIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7QUFBQSxNQUFBLG9DQUFBLENBQUE7QUFBQTtBQUFBLElBQUE7O0FBQUEsV0FBQSxTQUFBLEdBQUE7QUFBQTtBQUFBOztBQUFBOztBQUFBO0FBQUE7QUFBQTs7QUFBQSxXQUFBLFNBQUEsR0FBQTtBQUFBO0FBQUE7O0FBQUE7O0FBQUE7QUFBQTtBQUFBOztnQkNBRSxNQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOztBQUFBLHNCQUE4RyxTQUE5Rzs7QUFBQTs7QUFBQSxzQkRBRixTQ0FFO0FBQUE7QUFBQTtBREFGLEciLCJzb3VyY2VzQ29udGVudCI6W251bGwsIjw+PGRpdiBjbGFzcz1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHNwYWNlLXgtMiB0ZXh0LXdoaXRlIHAtMiByb3VuZGVkLWxnIGJnLWdyYXktOTAwIGJnLW9wYWNpdHktMTBcIj4gIDxidXR0b24gb25DbGljaz17aW5jcmVtZW50fSBjbGFzcz1cInAtMiByb3VuZGVkLWxnIGJnLWdyYXktOTAwIGJnLW9wYWNpdHktMTBcIj4gICAgSW5jcmVtZW50ICA8L2J1dHRvbj4gIDxzcGFuPkNvdW50OiB7Y291bnR9PC9zcGFuPiAgPGJ1dHRvbiBvbkNsaWNrPXtkZWNyZW1lbnR9IGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPiAgICBEZWNyZW1lbnQgIDwvYnV0dG9uPjwvZGl2PjwvPiJdfQ==