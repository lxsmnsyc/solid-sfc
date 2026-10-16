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
    ['<a {...props} />', '<a {...props} />'],
    ['<input disabled />', '<input disabled />'],
    ['<input value="a b">', '<input value="a b"/>'],
    ['<input value=x>', '<input value={x}/>'],
    ['<div use:ref=el class:active=on />', '<div use:ref={el} class:active={on} />'],
    ['<Comp render=<b>hi</b> />', '<Comp render=<b>hi</b> />'],
    ['<input value=value()>', '<input value={value()}/>'],
    ['<b onClick=props.onClick(event, 1) />', '<b onClick={props.onClick(event, 1)} />'],
    [
      '<b x=items[0].label y=map.get(key)?.name />',
      '<b x={items[0].label} y={map.get(key)?.name} />',
    ],
    ['<b x=a?.[i] y=fn?.(1) z=el! />', '<b x={a?.[i]} y={fn?.(1)} z={el!} />'],
    ['<b x=!valid y=-1 z=!!list.length />', '<b x={!valid} y={-1} z={!!list.length} />'],
    [
      '<b x=(a + b).toFixed(2) y=[1, 2].map(f) />',
      '<b x={(a + b).toFixed(2)} y={[1, 2].map(f)} />',
    ],
    ['<b x=css`color: red` y=`a`.length />', '<b x={css`color: red`} y={`a`.length} />'],
    ['<b x=a.b()>c</b>', '<b x={a.b()}>c</b>'],
    ['<div [name]=get(key) />', '<div {...{[name]: get(key)}} />'],
  ])('%s', (input, output) => {
    expect(markup(input)).toBe(output);
  });
});

describe('bind:', () => {
  it.each([
    [
      '<input bind:value=name>',
      '<input value={name} onInput={(event) => (name = event.currentTarget.value)}/>',
    ],
    [
      '<input type="number" bind:value=age />',
      '<input type="number" value={age} onInput={(event) => (age = event.currentTarget.valueAsNumber)} />',
    ],
    [
      "<input bind:value=age type='range' />",
      "<input value={age} onInput={(event) => (age = event.currentTarget.valueAsNumber)} type='range' />",
    ],
    [
      '<input type="checkbox" bind:checked=done />',
      '<input type="checkbox" checked={done} onChange={(event) => (done = event.currentTarget.checked)} />',
    ],
    [
      '<select bind:value=form.choice></select>',
      '<select value={form.choice} onInput={(event) => (form.choice = event.currentTarget.value)}></select>',
    ],
    [
      '<textarea bind:value=notes[i]></textarea>',
      '<textarea value={notes[i]} onInput={(event) => (notes[i] = event.currentTarget.value)}></textarea>',
    ],
  ])('%s', (input, output) => {
    expect(markup(input)).toBe(output);
  });

  it('writes signals with their setters', () => {
    expect(markup('<script>let name = $signal("");</script><input bind:value=name>')).toBe(
      '<input value={name()} onInput={(event) => (setname_1(() => event.currentTarget.value))}/>',
    );
  });

  it.each([
    ['<div bind:value=a />', 'bind:value is not supported on <div>'],
    ['<input bind:open=a />', 'bind:open is not supported on <input>'],
    ['<input bind:value=a onInput=b />', 'bind:value sets onInput'],
    ['<input bind:value=a() />', 'bind:value needs a variable or a property'],
    ['<input bind:value=(a) />', 'bind:value needs a variable or a property'],
    ['<input bind:value />', 'Expected a value for bind:value'],
  ])('rejects %s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
  });
});

describe('<solid:window> and <solid:document>', () => {
  it('compiles each handler to a listener', () => {
    expect(markup('<solid:window onKeyDown=close onResize=(() => measure()) />')).toBe(
      "{__listen('window', 'keydown', close)}{__listen('window', 'resize', (() => measure()))}",
    );
    expect(markup('<solid:document onVisibilityChange=pause />')).toBe(
      "{__listen('document', 'visibilitychange', pause)}",
    );
  });

  it('imports the runtime helper', () => {
    const { code } = compile('<solid:window onKeyDown=close />', { filename: 'W.solid' });
    expect(code).toContain("import { listen as __listen } from 'solid-sfc/runtime';");
  });

  it.each([
    ['<solid:window onKeyDown=a>', '<solid:window> must end with "/>"'],
    ['<solid:window class="a" />', '<solid:window> only takes event handlers'],
    ['<solid:document onClick />', 'Expected a value for onClick'],
  ])('rejects %s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
  });
});

describe('dynamic tags', () => {
  it('compiles to a component from dynamic()', () => {
    expect(markup('<{tag} class="a" {...rest}>Hi</>')).toBe(
      '{(() => { const __Tag = __dynamic(() => tag); return <__Tag class="a" {...rest}>Hi</__Tag>; })()}',
    );
    const { code } = compile('<{tag} />', { filename: 'D.solid' });
    expect(code).toContain("import { dynamic as __dynamic } from '@solidjs/web';");
  });

  it('takes any expression', () => {
    expect(markup("<{props.as ?? 'div'} />")).toBe(
      "{(() => { const __Tag = __dynamic(() => props.as ?? 'div'); return <__Tag />; })()}",
    );
  });

  it('works inside expressions and attributes', () => {
    expect(markup('<p>{a && <{icon} size=2 />}</p>')).toBe(
      '<p>{a && (() => { const __Tag = __dynamic(() => icon); return <__Tag size={2} />; })()}</p>',
    );
    expect(markup('<A icon=<{b} /> />')).toBe(
      '<A icon={(() => { const __Tag = __dynamic(() => b); return <__Tag />; })()} />',
    );
  });

  it('nests', () => {
    expect(markup('<{a}><{b} /></>')).toBe(
      '{(() => { const __Tag = __dynamic(() => a); return <__Tag>{(() => { const __Tag = __dynamic(() => b); return <__Tag />; })()}</__Tag>; })()}',
    );
  });

  it.each([
    ['<{} />', 'Expected an expression for the tag'],
    ['<{tag}>a</tag>', 'Expected </>'],
    ['<{tag} bind:value=a />', 'bind:value is not supported on a dynamic tag'],
    ['<solid:dynamic component=a />', 'Use <{tag}> instead of <solid:dynamic>'],
  ])('rejects %s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
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
    const { code, css } = compile(source, { filename: '/src/item-list.solid', scope: 'x' });
    expect(code).toMatchSnapshot('code');
    expect(css?.code).toMatchSnapshot('css');
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
    ['<a b=c+d />', 'Wrap this attribute value in parentheses'],
    ['<a b=c.d()e />', 'Wrap this attribute value in parentheses'],
    ['<a b=c!=d />', 'Wrap this attribute value in parentheses'],
    ['<a b=!"c" />', 'Wrap this attribute value in parentheses'],
    ['<a b={ c: 1 }.c />', 'Expected whitespace between attributes'],
    ['<a b=c?.1 />', 'Expected a property name'],
    ['<a (href) />', 'Use {href} for the shorthand of href={href}'],
    ['<a (b + c) />', 'Expected an attribute'],
    ['<a {b + c} />', 'Expected a spread or a shorthand attribute'],
    ['<a b="c"d />', 'Expected whitespace between attributes'],
    ['<script>export const a = 1;</script>', 'Use <script module>'],
    ['<script></script><script></script>', 'only have one <script>'],
    ['<script>$props(1)</script>', '$props() takes no arguments'],
    ['<script>let a = (</script>', 'Expected'],
    ['<!-- open', 'Unterminated comment'],
    ['<solid:for each=a>{f}</solid:for>', 'Use #for instead of <solid:for>'],
    ['<solid:show when=a />', 'Use #if instead of <solid:show>'],
    ['<solid:widget />', 'Unknown element <solid:widget>'],
    ['<solid:no-hydration />', 'Use #no-hydration instead of <solid:no-hydration>'],
  ])('%s', (input, message) => {
    expect(() => compile(input, { filename: 'Err.solid' })).toThrow(message);
  });

  it('reports the location', () => {
    expect(() => compile('<div>\n  <a b=c+d />\n</div>')).toThrow(
      expect.objectContaining({ name: 'SFCError', line: 2, column: 8 }),
    );
  });
});
