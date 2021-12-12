import { template as _$template } from "solid-js/web";
import { delegateEvents as _$delegateEvents } from "solid-js/web";
import { insert as _$insert } from "solid-js/web";
import { createSignal as _createSignal } from "solid-js";

const _tmpl$ = _$template(`<div class="flex items-center justify-center space-x-2 text-white p-2 rounded-lg bg-gray-900 bg-opacity-10"><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Increment</button><span>Count: </span><button class="p-2 rounded-lg bg-gray-900 bg-opacity-10">Decrement</button></div>`, 8);

export default function (props) {
  let [_count, _setcount] = _createSignal(0);

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
}

_$delegateEvents(["click"]);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LnNvbGlkIl0sIm5hbWVzIjpbImNvdW50Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUVBLE1BQUlBLG9DQUFKLENBQUlBLENBQUo7O0FBRUEsV0FBQSxTQUFBLEdBQXFCO0FBQ25CQTtBQUFBQTs7QUFBQUE7O0FBQUFBO0FBQUFBO0FBQ0Q7O0FBQ0QsV0FBQSxTQUFBLEdBQXFCO0FBQ25CQTtBQUFBQTs7QUFBQUE7O0FBQUFBO0FBQUFBO0FBUkY7Ozs7Ozs7OztvQkFZRSxTOzs7O29CQUlBLFMiLCJzb3VyY2VzQ29udGVudCI6WyJcbi0tLVxubGV0IGNvdW50ID0gJHNpZ25hbCgwKTtcblxuZnVuY3Rpb24gaW5jcmVtZW50KCkge1xuICBjb3VudCsrO1xufVxuZnVuY3Rpb24gZGVjcmVtZW50KCkge1xuICBjb3VudC0tO1xufVxuLS0tXG48ZGl2IGNsYXNzPVwiZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgc3BhY2UteC0yIHRleHQtd2hpdGUgcC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPlxuICA8YnV0dG9uIG9uQ2xpY2s9e2luY3JlbWVudH0gY2xhc3M9XCJwLTIgcm91bmRlZC1sZyBiZy1ncmF5LTkwMCBiZy1vcGFjaXR5LTEwXCI+XG4gICAgSW5jcmVtZW50XG4gIDwvYnV0dG9uPlxuICA8c3Bhbj5Db3VudDoge2NvdW50fTwvc3Bhbj5cbiAgPGJ1dHRvbiBvbkNsaWNrPXtkZWNyZW1lbnR9IGNsYXNzPVwicC0yIHJvdW5kZWQtbGcgYmctZ3JheS05MDAgYmctb3BhY2l0eS0xMFwiPlxuICAgIERlY3JlbWVudFxuICA8L2J1dHRvbj5cbjwvZGl2PlxuIl19