import { load, save } from './storage.ts';

export interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: number;
}

export type Filter = 'all' | 'active' | 'done';

export const FILTERS: readonly Filter[] = ['all', 'active', 'done'];

const EXAMPLE_TASKS: Task[] = [
  { id: 1, title: 'Write a .solid component', done: true, priority: 2 },
  { id: 2, title: 'Try the control flow blocks', done: false, priority: 3 },
  { id: 3, title: 'Style it with scoped CSS', done: false, priority: 1 },
];

export function loadTasks(): Task[] {
  return load('tasks', EXAMPLE_TASKS);
}

export function saveTasks(tasks: Task[]): void {
  save('tasks', tasks);
}
