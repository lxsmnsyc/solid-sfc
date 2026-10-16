/** Starting points for the playground. */
export const examples: { name: string; source: string }[] = [
  {
    name: 'Counter',
    source: `<script>
  let count = $signal(0);
  const doubled = $memo(count * 2);
</script>

<style>
  button {
    color: \${count > 4 ? 'crimson' : 'inherit'};
  }
</style>

<button onClick=(() => count++)>
  Clicked {count} times
</button>

#if (count > 4) {
  <p>Doubled: {doubled}</p>
}
`,
  },
  {
    name: 'Todo list',
    source: `<script>
  interface Todo {
    id: number;
    title: string;
    done: boolean;
  }

  let todos: Todo[] = $signal([]);
  let draft = $signal('');

  function add(event: SubmitEvent) {
    event.preventDefault();
    todos = [...todos, { id: Date.now(), title: draft, done: false }];
    draft = '';
  }

  function toggle(id: number) {
    todos = todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo));
  }
</script>

<style>
  .done {
    text-decoration: line-through;
  }
</style>

<form onSubmit=add>
  <input bind:value=draft placeholder="What needs doing?">
  <button disabled=!draft.trim()>Add</button>
</form>

<ul>
  #for (todo of todos by todo.id) {
    <li>
      <label class={ done: todo.done }>
        <input type="checkbox" checked=todo.done onChange=(() => toggle(todo.id))>
        {todo.title}
      </label>
    </li>
  } #else {
    <li>Nothing to do.</li>
  }
</ul>
`,
  },
  {
    name: 'Async data',
    source: `<script>
  async function fetchQuote(id: number): Promise<string> {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return \`Quote number \${id}\`;
  }

  let id = $signal(1);
  const quote = $memo(fetchQuote(id));
</script>

#try {
  #loading {
    <blockquote>{quote}</blockquote>
    <button onClick=(() => id++)>Next</button>
  } #else {
    <p>Loading…</p>
  }
} #catch (error, reset) {
  <button onClick=reset>Try again</button>
}
`,
  },
  {
    name: 'Templates and dynamic tags',
    source: `<script>
  const { level = 2 } = $props<{ level?: 1 | 2 | 3 }>();
  const items = ['Script', 'Style', 'Markup'];
</script>

<{\`h\${level}\`} class="title">Parts of a file</>

<ol>
  #for (item of items) {
    {row(item)}
  }
</ol>

#template row(label: string) {
  <li><strong>{label}</strong></li>
}
`,
  },
];
