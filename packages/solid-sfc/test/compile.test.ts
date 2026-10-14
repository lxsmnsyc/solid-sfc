import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

function markup(template: string): string {
  const { code } = compile(template, { filename: 'Test.solid' });
  const start = code.indexOf('return (<>') + 'return (<>'.length;
  const end = code.lastIndexOf('</>);');
  return code.slice(start, end).trim();
}

function expectValidTSX(code: string): void {
  const { errors } = parseSync('out.tsx', code, { sourceType: 'module', lang: 'tsx' });
  expect(errors.map((error) => error.message)).toEqual([]);
}

describe('attributes', () => {
  it.each([
    ['<button onClick=increment />', '<button onClick={increment} />'],
    ['<Button value=3.14159 />', '<Button value={3.14159} />'],
    ['<Button value=null flag=true />', '<Button value={null} flag={true} />'],
    ['<a href=(link) />', '<a href={(link)} />'],
    ['<a href=(base + path) />', '<a href={(base + path)} />'],
    ['<div id=`div-${id}` />', '<div id={`div-${id}`} />'],
    ['<div items=[1, 2] />', '<div items={[1, 2]} />'],
    ['<div pattern=/a+b/g />', '<div pattern={/a+b/g} />'],
    ["<div style={ color: 'red' } />", "<div style={{ color: 'red' }} />"],
    ['<div [name]=value />', '<div {...{[name]: value}} />'],
    ['<div [name]={ a: 1 } />', '<div {...{[name]: ({ a: 1 })}} />'],
    ['<div [name] />', '<div {...{[name]: true}} />'],
    ['<a {href} />', '<a href={href} />'],
    ['<a (href) />', '<a href={href} />'],
    ['<a {...props} />', '<a {...props} />'],
    ['<input disabled />', '<input disabled />'],
    ['<input value="a b">', '<input value="a b"/>'],
    ['<input value=x>', '<input value={x}/>'],
    ['<div use:ref=el class:active=on />', '<div use:ref={el} class:active={on} />'],
    ['<Comp render=<b>hi</b> />', '<Comp render=<b>hi</b> />'],
  ])('%s', (input, output) => {
    expect(markup(input)).toBe(output);
  });
});

describe('children', () => {
  it('removes XML comments', () => {
    expect(markup('<div><!-- note --></div>')).toBe('<div></div>');
  });

  it('keeps expression children', () => {
    expect(markup('<p>{count() > 1 ? "a" : "b"}</p>')).toBe('<p>{count() > 1 ? "a" : "b"}</p>');
  });

  it('rewrites JSX inside expressions', () => {
    expect(markup('<ul>{items.map((item) => <li key=item>{item}</li>)}</ul>')).toBe(
      '<ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>',
    );
  });

  it('rewrites fragments inside expressions', () => {
    expect(markup('<div>{show && <><b title=x /></>}</div>')).toBe(
      '<div>{show && <><b title={x} /></>}</div>',
    );
  });

  it('does not treat comparisons as elements', () => {
    expect(markup('<p>{a < b ? 1 : 2}</p>')).toBe('<p>{a < b ? 1 : 2}</p>');
  });

  it('keeps text with quotes', () => {
    expect(markup("<p>Don't stop</p>")).toBe("<p>Don't stop</p>");
  });
});

describe('component', () => {
  it('compiles a full component', () => {
    const source = `<script module>
  export const version = 1;
</script>

<script lang="ts">
  import { For } from 'solid-js';
  export interface Props {
    items: string[];
  }
  type Item = string;
  const props = $props<Props>();
  let count = $signal(0);
</script>

<style>
  li { color: \${color}; content: "\\201C"; }
</style>

<style global>
  body { margin: 0 }
</style>

<For each=(props.items)>
  {(item: Item) => <li onClick=(() => count++)>{item}</li>}
</For>
`;
    const { code, hasStyles } = compile(source, { filename: '/src/item-list.solid' });
    expect(hasStyles).toBe(true);
    expect(code).toMatchSnapshot();
    expectValidTSX(code);
  });

  it('uses generics from the script', () => {
    const { code } = compile(
      '<script generics="T">\n  const props = $props<{ value: T }>();\n</script>\n<p>{String(props.value)}</p>',
      { filename: 'Generic.solid' },
    );
    expect(code).toContain('export default function Generic<T>($$props: { value: T })');
    expectValidTSX(code);
  });

  it('types untyped props', () => {
    const { code } = compile('<script>const props = $props();</script>', { filename: 'A.solid' });
    expect(code).toContain('($$props: Record<string, any>)');
  });

  it('builds a valid component name', () => {
    expect(compile('', { filename: '/a/my-button.solid' }).code).toContain('function MyButton(');
    expect(compile('', { filename: '/a/404.solid' }).code).toContain('function Component404(');
    expect(compile('').code).toContain('function Component(');
  });

  it('generates a source map that points to the file', () => {
    const { map } = compile('<script>let a = 1;</script>\n<p title=a />', {
      filename: 'Map.solid',
    });
    expect(map.sources).toEqual(['Map.solid']);
    expect(map.mappings.length).toBeGreaterThan(0);
  });
});

describe('errors', () => {
  it.each([
    ['<div>', 'expected a closing tag'],
    ['<div></span>', 'Expected </div>'],
    ['</div>', 'Unexpected closing tag'],
    ['<a b=c.d() />', 'Wrap this attribute value in parentheses'],
    ['<a (b + c) />', 'Expected an identifier'],
    ['<a {b + c} />', 'Expected a spread or a shorthand attribute'],
    ['<a b="c"d />', 'Expected whitespace between attributes'],
    ['<script>export const a = 1;</script>', 'Use <script module>'],
    ['<script></script><script></script>', 'only have one <script>'],
    ['<script>$props(1)</script>', '$props() takes no arguments'],
    ['<script>let a = (</script>', 'Expected'],
    ['<!-- open', 'Unterminated comment'],
  ])('%s', (input, message) => {
    expect(() => compile(input, { filename: 'Err.solid' })).toThrow(message);
  });

  it('reports the location', () => {
    expect(() => compile('<div>\n  <a b=c.d() />\n</div>')).toThrow(
      expect.objectContaining({ name: 'SFCError', line: 2, column: 8 }),
    );
  });
});
