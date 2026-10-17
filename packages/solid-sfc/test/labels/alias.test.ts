import { describe, expect, it } from 'vitest';
import transform from './util';

describe('auto-import aliases', () => {
  it('compiles reactivity aliases', () => {
    expect(
      transform(`
const dispose = $root(() => setup());
$trackedEffect(() => console.log('tracked'));
const track = $reaction(() => console.log('reacted'));
$flush();
`),
    ).toMatchSnapshot();
  });
  it('compiles lifecycle aliases', () => {
    expect(
      transform(`
$settled(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
});
$cleanup(() => dispose());
`),
    ).toMatchSnapshot();
  });
  it('compiles async aliases', () => {
    expect(
      transform(`
const save = $action(function* (todo) {
  yield api.add(todo);
  $refresh(todos);
});
const pending = $isPending(() => user());
const peeked = $latest(id);
$affects(user);
`),
    ).toMatchSnapshot();
  });
  it('compiles component API aliases', () => {
    expect(
      transform(`
const id = $uid();
const merged = $merge(defaults, props);
const rest = $omit(props, 'class');
const Ctx = $createContext(0);
const value = $useContext(Ctx);
const owner = $owner();
$runWithOwner(owner, () => work());
`),
    ).toMatchSnapshot();
  });
  it('compiles store aliases', () => {
    expect(
      transform(`
const [store, setStore] = $store({ list: [] });
const items = $projection(() => api.list(), [], { key: 'id' });
const [name, setName] = $optimistic('Alice');
const [todos, setTodos] = $optimisticStore(() => api.list(), []);
setStore(s => { $reconcile(data, 'id')(s.list); });
const plain = $snapshot(store);
const tracked = $deep(store);
`),
    ).toMatchSnapshot();
  });
  it('compiles arrow CTFs', () => {
    expect(
      transform(`
let count = $signal(0);
const value = $untrack(count);
const Page = $lazy(import('./Page'));
const settled = $resolve(user);
`),
    ).toMatchSnapshot();
  });
  it('wraps the value of $isPending and $latest in a function', () => {
    const code = transform(`
const quote = $memo(fetchQuote(id));
let count = $signal(0);
const a = $isPending(quote);
const b = $isPending(quote.text);
const c = $isPending(() => quote);
const d = $latest(count);
`);
    expect(code).toContain('const a = _isPending(() => quote());');
    expect(code).toContain('const b = _isPending(() => quote().text);');
    expect(code).toContain('const c = _isPending(() => quote());');
    expect(code).toContain('const d = _latest(() => count());');
  });
  it('passes the accessor of a reactive variable to $refresh', () => {
    const code = transform(`
const quote = $memo(fetchQuote(id));
let count = $signal(0);
const reload = () => $refresh(quote);
const again = () => $refresh(store);
$effect(() => {
  if (count > 2) {
    $refresh(quote);
  }
});
`);
    expect(code).toContain('const reload = () => _refresh(quote);');
    expect(code).toContain('const again = () => _refresh(store);');
    // The effect gets the accessor, and does not track it.
    expect(code).toContain('_createEffect(() => [count(), quote], ');
    expect(code).toMatch(/if \(count > 2\) \{\s*_refresh\(quote\);/);
  });
  it('rejects $refresh on a variable that the effect also reads', () => {
    expect(() =>
      transform(`
const quote = $memo(fetchQuote(id));
$effect(() => {
  console.log(quote);
  $refresh(quote);
});
`),
    ).toThrow('$refresh cannot be used on a variable that the effect callback also reads');
  });
  it('respects shadowing', () => {
    expect(
      transform(`
const $merge = (a, b) => ({ ...a, ...b });
const merged = $merge(a, b);
`),
    ).toMatchSnapshot();
  });
});
