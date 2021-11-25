import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.solid");import { template as _$template } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { delegateEvents as _$delegateEvents } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { memo as _$memo } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
import { insert as _$insert } from "/node_modules/.vite/solid-js_web.js?v=3923be10";
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

  return [(() => {
    const _el$ = _tmpl$.cloneNode(true),
          _el$2 = _el$.firstChild,
          _el$3 = _el$2.nextSibling,
          _el$4 = _el$3.firstChild,
          _el$5 = _el$3.nextSibling;

    _el$2.$$click = increment;

    _$insert(_el$3, _count, null);

    _el$5.$$click = decrement;
    return _el$;
  })(), _$memo(() => props["fallback"])];
};

const {
  _$handler,
  _$Component
} = _$hot($HotComponent, !!import.meta.hot);

if (import.meta.hot) import.meta.hot.accept(_$handler);
export default _$Component;

_$delegateEvents(["click"]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkFwcC5zb2xpZCJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7O0FBQ0EsTUFBQSxvQ0FBQSxDQUFBO0FBQUE7QUFBQSxJQUFBOztBQUVBLFdBQUEsU0FBQSxHQUFBO0FBQ0E7QUFBQTs7QUFBQTs7QUFBQTtBQUFBO0FBQ0E7O0FBQ0EsV0FBQSxTQUFBLEdBQUE7QUFDQTtBQUFBOztBQUFBOztBQUFBO0FBQUE7QUFDQTs7Ozs7Ozs7O29CQUdBLFM7Ozs7b0JBSUEsUzs7cUJBTEEsS0FBQSxDQUFBLFVBQUEsQyIsInNvdXJjZXNDb250ZW50IjpbIi0tLVxubGV0IGNvdW50ID0gJHNpZ25hbCgwKTtcblxuZnVuY3Rpb24gaW5jcmVtZW50KCkge1xuICBjb3VudCsrO1xufVxuZnVuY3Rpb24gZGVjcmVtZW50KCkge1xuICBjb3VudC0tO1xufVxuLS0tXG48ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgc3BhY2UteC0yIHRleHQtd2hpdGUgcC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPlxuICA8YnV0dG9uIG9uQ2xpY2s9e2luY3JlbWVudH0gY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBiZy1ncmF5LTkwMCBiZy1vcGFjaXR5LTEwXCI+XG4gICAgSW5jcmVtZW50XG4gIDwvYnV0dG9uPlxuICA8c3Bhbj5Db3VudDoge2NvdW50fTwvc3Bhbj5cbiAgPGJ1dHRvbiBvbkNsaWNrPXtkZWNyZW1lbnR9IGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPlxuICAgIERlY3JlbWVudFxuICA8L2J1dHRvbj5cbjwvZGl2PlxuPHNvbGlkOnNsb3QgbmFtZT1cImZhbGxiYWNrXCIgLz4iXX0=