import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

/** The compiled markup, without the surrounding fragment and blank lines. */
function markup(template: string): string {
  const { code } = compile(template, { filename: 'Flow.solid' });
  const { errors } = parseSync('out.tsx', code, { lang: 'tsx', sourceType: 'module' });
  expect(errors.map((error) => error.message)).toEqual([]);
  const start = code.indexOf('return (<>') + 'return (<>'.length;
  return code.slice(start, code.lastIndexOf('</>);')).replace(/\n\s*/g, ' ').trim();
}

function imports(template: string): string {
  return compile(template, { filename: 'Flow.solid' })
    .code.split('\n')
    .filter((line) => line.startsWith('import '))
    .join('\n');
}

describe('#if', () => {
  it('compiles to a conditional expression', () => {
    expect(markup('#if (a) { <p /> }')).toBe('{(a) ? <> <p /> </> : null}');
  });

  it('chains #else if and #else', () => {
    expect(markup('#if (a) { <p /> } #else if (b) { <q /> } #else { <r /> }')).toBe(
      '{(a) ? <> <p /> </> : (b) ? <> <q /> </> : <> <r /> </>}',
    );
  });

  it('allows comments between branches', () => {
    expect(markup('#if (a) { <p /> } <!-- note --> #else { <r /> }')).toBe(
      '{(a) ? <> <p /> </> : <> <r /> </>}',
    );
  });

  it('nests inside elements and other blocks', () => {
    expect(markup('<div>#if (a) { #if (b) { <p /> } }</div>')).toBe(
      '<div>{(a) ? <> {(b) ? <> <p /> </> : null} </> : null}</div>',
    );
  });

  it('works inside JSX in expressions', () => {
    expect(markup('<ul>{list.map((x) => <li>#if (x) { <b /> }</li>)}</ul>')).toBe(
      '<ul>{list.map((x) => <li>{(x) ? <> <b /> </> : null}</li>)}</ul>',
    );
  });

  it('reads reactive variables in conditions', () => {
    expect(markup('<script>let a = $signal(0);</script>#if (a > 1) { <p>{a}</p> }')).toBe(
      '{(a() > 1) ? <> <p>{a()}</p> </> : null}',
    );
  });
});

describe('#for', () => {
  it('compiles to <For>', () => {
    expect(markup('#for (item of list) { <li>{item}</li> }')).toBe(
      '<_For each={list}>{(item) => <> <li>{item}</li> </>}</_For>',
    );
    expect(imports('#for (item of list) { <li /> }')).toContain(
      'import { For as _For } from "solid-js";',
    );
  });

  it('reads the index without a call', () => {
    expect(markup('#for (item, i of list) { <li>{i}</li> }')).toBe(
      '<_For each={list}>{(item, __i) => { const i = __i; return <> <li>{i()}</li> </>; }}</_For>',
    );
  });

  it('accepts destructured items', () => {
    expect(markup('#for ({ id, name } of users) { <li id=id>{name}</li> }')).toBe(
      '<_For each={users}>{({ id, name }) => <> <li id={id}>{name}</li> </>}</_For>',
    );
  });

  it('moves #else to the fallback', () => {
    expect(markup('#for (item of list) { <li /> } #else { <p>Empty</p> }')).toBe(
      '<_For each={list} fallback={<> <p>Empty</p> </>}>{(item) => <> <li /> </>}</_For>',
    );
  });

  it('accepts an empty #else', () => {
    expect(markup('#for (item of list) { <li /> } #else {}')).toBe(
      '<_For each={list} fallback={<></>}>{(item) => <> <li /> </>}</_For>',
    );
  });
});

describe('#index', () => {
  it('compiles to <For keyed={false}> and reads the item without a call', () => {
    expect(markup('#index (row, i of rows) { <p>{row} {i}</p> }')).toBe(
      '<_For each={rows} keyed={false}>{(__row, i) => { const row = __row; return <> <p>{row()} {i}</p> </>; }}</_For>',
    );
  });
});

describe('#repeat', () => {
  it('compiles to <Repeat>', () => {
    expect(markup('#repeat (n of count) { <i>{n}</i> } #else { <p /> }')).toBe(
      '<_Repeat count={count} fallback={<> <p /> </>}>{(n) => <> <i>{n}</i> </>}</_Repeat>',
    );
  });
});

describe('#switch', () => {
  it('compiles to <Switch> and <Match>', () => {
    expect(
      markup(
        '#switch {\n  #case (a) { <p /> }\n  <!-- x -->\n  #case (b) { <q /> }\n  #default { <r /> }\n}',
      ),
    ).toBe(
      '<_Switch><_Match when={a}><> <p /> </></_Match><_Match when={b}><> <q /> </></_Match><_Match when={true}><> <r /> </></_Match></_Switch>',
    );
  });
});

describe('#try', () => {
  it('compiles to <Errored> and reads the error without a call', () => {
    expect(markup('#try { <W /> } #catch (error, reset) { <p onClick=reset>{error}</p> }')).toBe(
      '<_Errored fallback={(__error, reset) => { const error = __error; return <> <p onClick={reset}>{error()}</p> </>; }}> <W /> </_Errored>',
    );
  });

  it('accepts #catch without parameters', () => {
    expect(markup('#try { <W /> } #catch { <p /> }')).toBe(
      '<_Errored fallback={<> <p /> </>}> <W /> </_Errored>',
    );
  });
});

describe('#loading', () => {
  it('compiles to <Loading>', () => {
    expect(markup('#loading { <P /> } #fallback { <S /> }')).toBe(
      '<_Loading fallback={<> <S /> </>}> <P /> </_Loading>',
    );
    expect(markup('#loading { <P /> }')).toBe('<_Loading> <P /> </_Loading>');
  });
});

describe('#loading (on)', () => {
  it('passes the header as the on prop', () => {
    expect(markup('#loading (id) { <P /> } #fallback { <S /> }')).toBe(
      '<_Loading on={id} fallback={<> <S /> </>}> <P /> </_Loading>',
    );
    expect(markup('#loading ( user.id ) { <P /> }')).toBe(
      '<_Loading on={user.id}> <P /> </_Loading>',
    );
  });
});

describe('#reveal', () => {
  it('compiles to <Reveal>', () => {
    expect(markup('#reveal { <A /> }')).toBe('<_Reveal> <A /> </_Reveal>');
    expect(imports('#reveal { <A /> }')).toContain('import { Reveal as _Reveal } from "solid-js";');
  });

  it('passes the order and collapsed props', () => {
    expect(markup("#reveal ('sequential') { <A /> }")).toBe(
      "<_Reveal order={'sequential'}> <A /> </_Reveal>",
    );
    expect(markup("#reveal ('together', fold(a, b)) { <A /> }")).toBe(
      "<_Reveal order={'together'} collapsed={fold(a, b)}> <A /> </_Reveal>",
    );
  });
});

describe('#portal', () => {
  it('compiles to <Portal>', () => {
    expect(markup('#portal { <dialog /> }')).toBe('<_Portal> <dialog /> </_Portal>');
    expect(markup('#portal (target) { <dialog /> }')).toBe(
      '<_Portal mount={target}> <dialog /> </_Portal>',
    );
    expect(imports('#portal { <A /> }')).toContain(
      'import { Portal as _Portal } from "@solidjs/web";',
    );
  });
});

describe('#key', () => {
  it('uses the runtime helper', () => {
    expect(markup('#key (id) { <P /> }')).toBe('{__key(() => (id), () => <> <P /> </>)}');
    expect(imports('#key (id) { <P /> }')).toContain(
      "import { key as __key } from 'solid-sfc/runtime';",
    );
  });
});

describe('text', () => {
  it.each([
    'mail me@site.com',
    'a #hashtag here',
    '#if without parentheses',
    'C# and F#',
    'x#if (a) { }',
  ])('keeps "%s"', (text) => {
    expect(markup(`<p>${text}</p>`)).toBe(`<p>${text}</p>`);
  });

  it('does not scope control flow blocks', () => {
    const { code } = compile('<style>p {}</style>#if (a) { <p /> }', { scope: 'x' });
    expect(code).toContain('{(a) ? <> <p s-x /> </> : null}');
  });
});

describe('errors', () => {
  it.each([
    ['#if (a) { <p />', 'Expected "}" to close the block'],
    ['<div>#if (a) { </div> }', 'Expected "}" to close the block'],
    ['#if () { }', 'Expected an expression after #if'],
    ['#if (a) <p />', 'Expected "{" after #if'],
    ['#else { }', '#else must follow its block'],
    ['#for (item in list) { }', 'Expected "item of list"'],
    ['#for (a, b, c of list) { }', 'Expected "item of list"'],
    ['#index ({ a } of list) { }', '#index needs an identifier'],
    ['#switch { <p /> }', 'Expected #case, #default or "}" in #switch'],
    ['#switch { #default { } #case (a) { } }', '#default must be the last branch'],
    ['#try { <W /> }', '#try needs a #catch block'],
    ['#try { } #catch ({ a }) { }', 'Expected "(error)" or "(error, reset)"'],
    ['#portal (a, b) { }', 'Expected "(mount)" after #portal'],
    ['#reveal (a, b, c) { }', 'Expected "(order, collapsed)" after #reveal'],
    ['#loading (a, b) { }', 'Expected "(on)" after #loading'],
  ])('%s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
  });

  it('reports the location of the block', () => {
    expect(() => compile('<div>\n  #if () { }\n</div>')).toThrow(
      expect.objectContaining({ line: 2, column: 7 }),
    );
  });
});
