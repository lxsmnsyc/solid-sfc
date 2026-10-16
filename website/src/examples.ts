/**
 * Starting points for the playground. Each one is a `.solid` file in
 * `examples/`, so it is type-checked with the rest of the site.
 */
import asyncData from './examples/AsyncData.solid?raw';
import counter from './examples/Counter.solid?raw';
import formBindings from './examples/FormBindings.solid?raw';
import scopedStyles from './examples/ScopedStyles.solid?raw';
import tabs from './examples/Tabs.solid?raw';
import templates from './examples/Templates.solid?raw';
import todoList from './examples/TodoList.solid?raw';
import windowEvents from './examples/WindowEvents.solid?raw';

export const examples: { name: string; source: string }[] = [
  { name: 'Counter', source: counter },
  { name: 'Todo list', source: todoList },
  { name: 'Form bindings', source: formBindings },
  { name: 'Scoped styles', source: scopedStyles },
  { name: 'Async data', source: asyncData },
  { name: 'Switch, repeat and key', source: tabs },
  { name: 'Templates and dynamic tags', source: templates },
  { name: 'Window events', source: windowEvents },
];
