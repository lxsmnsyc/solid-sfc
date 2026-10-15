export interface Task {
  id: number;
  title: string;
  done: boolean;
  priority: number;
}

export type Filter = 'all' | 'active' | 'done';

export const FILTERS: readonly Filter[] = ['all', 'active', 'done'];

const STORAGE_KEY = 'solid-sfc-tasks';

const EXAMPLE_TASKS: Task[] = [
  { id: 1, title: 'Write a .solid component', done: true, priority: 2 },
  { id: 2, title: 'Try the control flow blocks', done: false, priority: 3 },
  { id: 3, title: 'Style it with scoped CSS', done: false, priority: 1 },
];

export function loadTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as Task[]) : EXAMPLE_TASKS;
  } catch {
    return EXAMPLE_TASKS;
  }
}

export function saveTasks(tasks: Task[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch {
    // Storage can be unavailable, for example in private windows.
  }
}
