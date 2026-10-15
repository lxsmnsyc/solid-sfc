import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile, compileStructure } from '../src/index.ts';

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

describe('#for by', () => {
  it('keys items with a key function', () => {
    expect(markup('#for (user, i of users by user.id) { <p>{user.name} {i}</p> }')).toBe(
      '<_For each={users} keyed={(user) => (user.id)}>{(__user, __i) => { const user = __user; const i = __i; return <> <p>{user().name} {i()}</p> </>; }}</_For>',
    );
  });

  it('keeps one entry per position with by index', () => {
    expect(markup('#for (row, i of rows by index) { <p>{row} {i}</p> }')).toBe(
      '<_For each={rows} keyed={false}>{(__row, i) => { const row = __row; return <> <p>{row()} {i}</p> </>; }}</_For>',
    );
    expect(markup('#for (row, n of rows by n) { <p>{row}</p> }')).toBe(
      '<_For each={rows} keyed={false}>{(__row, n) => { const row = __row; return <> <p>{row()}</p> </>; }}</_For>',
    );
  });

  it('destructures items that are accessors', () => {
    expect(markup('#for ({ id, name } of users by id) { <p>{name}</p> }')).toBe(
      '<_For each={users} keyed={({ id, name }) => (id)}>{(__item) => { const __itemValue = __item; const id = () => __itemValue().id, name = () => __itemValue().name; return <> <p>{name()}</p> </>; }}</_For>',
    );
  });

  it('moves #else to the fallback', () => {
    expect(markup('#for (row of rows by index) { <p /> } #else { <q /> }')).toBe(
      '<_For each={rows} keyed={false} fallback={<> <q /> </>}>{(__row) => { const row = __row; return <> <p /> </>; }}</_For>',
    );
  });
});

describe('#repeat', () => {
  it('accepts a count without an index', () => {
    expect(markup('#repeat (3) { <i /> }')).toBe(
      '<_Repeat count={3}>{() => <> <i /> </>}</_Repeat>',
    );
    expect(markup('#repeat ( stars ) { <i /> } #else { <p /> }')).toBe(
      '<_Repeat count={stars} fallback={<> <p /> </>}>{() => <> <i /> </>}</_Repeat>',
    );
  });

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
    expect(markup('#loading { <P /> } #else { <S /> }')).toBe(
      '<_Loading fallback={<> <S /> </>}> <P /> </_Loading>',
    );
    expect(markup('#loading { <P /> }')).toBe('<_Loading> <P /> </_Loading>');
  });
});

describe('#loading (on)', () => {
  it('passes the header as the on prop', () => {
    expect(markup('#loading (id) { <P /> } #else { <S /> }')).toBe(
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

describe('#const', () => {
  it('declares memos before the markup of a block', () => {
    expect(markup('#if (a) { #const x = a * 2; #const y = x + 1; <p>{y}</p> }')).toBe(
      '{(a) ? <>{(() => { const x = _createMemo(() => a * 2); const y = _createMemo(() => x() + 1); return <> <p>{y()}</p> </>; })()}</> : null}',
    );
  });

  it('works in loops and fallbacks', () => {
    expect(
      markup(
        '#for (n of list) { #const d = n * 2; <i>{d}</i> } #else { #const e = 0; <b>{e}</b> }',
      ),
    ).toBe(
      '<_For each={list} fallback={<>{(() => { const e = _createMemo(() => 0); return <> <b>{e()}</b> </>; })()}</>}>{(n) => <>{(() => { const d = _createMemo(() => n * 2); return <> <i>{d()}</i> </>; })()}</>}</_For>',
    );
  });

  it('allows comments between declarations', () => {
    expect(markup('#if (a) { #const x = 1; <!-- c --> #const y = 2; {x + y} }')).toBe(
      '{(a) ? <>{(() => { const x = _createMemo(() => 1);  const y = _createMemo(() => 2); return <> {x() + y()} </>; })()}</> : null}',
    );
  });

  it('keeps other #const text', () => {
    expect(markup('<p>#const values</p>')).toBe('<p>#const values</p>');
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

describe('generated props', () => {
  it('finds the name of each prop and the source of its value', () => {
    const source = '#for (x of list) { }\n#switch { #case ( a ) { } }\n#portal (target) { }';
    const { code, generated } = compileStructure(source);
    expect(
      generated.map((prop) => [
        code.slice(prop.generatedOffset, prop.generatedOffset + prop.generatedLength),
        source.slice(prop.sourceOffset, prop.sourceOffset + prop.sourceLength),
      ]),
    ).toEqual([
      ['each', 'list'],
      ['when', 'a'],
      ['mount', 'target'],
    ]);
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
    ['#for (a, { b } of list) { }', 'The index of #for must be an identifier'],
    ['#for (a of list by ) { }', 'Expected "item of list"'],
    ['#switch { <p /> }', 'Expected #case, #default or "}" in #switch'],
    ['#switch { #default { } #case (a) { } }', '#default must be the last branch'],
    ['#try { <W /> }', '#try needs a #catch block'],
    ['#try { } #catch ({ a }) { }', 'Expected "(error)" or "(error, reset)"'],
    ['#portal (a, b) { }', 'Expected "(mount)" after #portal'],
    ['#reveal (a, b, c) { }', 'Expected "(order, collapsed)" after #reveal'],
    ['#loading (a, b) { }', 'Expected "(on)" after #loading'],
    ['#const x = 1;', '#const must be directly inside a block'],
    ['<p>#const x = 1;</p>', '#const must be directly inside a block'],
    ['#if (a) { <p /> #const x = 1; }', '#const must come before the markup of its block'],
    ['#if (a) { #const x = 1 }', 'Expected ";"'],
    ['#if (a) { #const x = ; }', 'Expected "#const name = value;"'],
    ['#if (a) { #const { x } = a; }', '#const needs a name'],
  ])('%s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
  });

  it('reports the location of the block', () => {
    expect(() => compile('<div>\n  #if () { }\n</div>')).toThrow(
      expect.objectContaining({ line: 2, column: 7 }),
    );
  });
});
