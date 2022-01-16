// @refresh granular
import Message from './Message.solid';
import OtherMessage from './OtherMessage';

let count = $signal(0);
const message = $memo(`Count: ${count}`);

function increment() {
  count += 1;
}

function decrement() {
  count -= 1;
}

export default $view((
  <div class="flex items-center justify-center space-x-2 text-white p-2 rounded-lg bg-gray-900 bg-opacity-10">
    <button type="button" onClick={increment} class="p-2 rounded-lg bg-gray-900 bg-opacity-10">
      Increment
    </button>
    <Message message={message} />
    <OtherMessage message={message} />
    <button type="button" onClick={decrement} class="p-2 rounded-lg bg-gray-900 bg-opacity-10">
      Decrement
    </button>
  </div>
));
