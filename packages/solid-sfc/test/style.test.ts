import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

function css(style: string, attributes = ''): string {
  const result = compile(`<style${attributes}>${style}</style>`, { scope: 'x' });
  return result.css?.code.replace(/\s+/g, ' ').trim() ?? '';
}

function markup(template: string): string {
  const { code } = compile(template, { scope: 'x' });
  const start = code.indexOf('return (<>') + 'return (<>'.length;
  return code.slice(start, code.lastIndexOf('</>);')).trim();
}

describe('selectors', () => {
  it.each([
    ['div { color: red }', 'div[s-x] { color: red }'],
    ['.a .b { color: red }', '.a .b[s-x] { color: red }'],
    ['.a > .b, .c { color: red }', '.a > .b[s-x], .c[s-x] { color: red }'],
    ['a:hover { color: red }', 'a:hover[s-x] { color: red }'],
    ['p::before { content: "" }', 'p[s-x]::before { content: "" }'],
    ['p:after { content: "" }', 'p[s-x]:after { content: "" }'],
    ['::selection { color: red }', '[s-x]::selection { color: red }'],
    ['* { margin: 0 }', '*[s-x] { margin: 0 }'],
    [':global(body) { margin: 0 }', 'body { margin: 0 }'],
    [':global(.dark) .a { color: red }', '.dark .a[s-x] { color: red }'],
    ['.a :global(.b) { color: red }', '.a[s-x] .b { color: red }'],
    ['.a :global(.b .c) { color: red }', '.a[s-x] .b .c { color: red }'],
    [':global(.a .b) { color: red }', '.a .b { color: red }'],
    [':global(.a) :global(.b) { color: red }', '.a .b { color: red }'],
    ['.a { &:hover { color: red } }', '.a[s-x] { &:hover { color: red } }'],
    ['.a { & span { color: red } }', '.a[s-x] { & span[s-x] { color: red } }'],
    ['@media (width > 1px) { a { color: red } }', '@media (width > 1px) { a[s-x] { color: red } }'],
  ])('%s', (input, output) => {
    expect(css(input)).toBe(output);
  });

  it('does not scope global blocks', () => {
    expect(css('body { margin: 0 }', ' global')).toBe('body { margin: 0 }');
  });

  it('scopes keyframes and the animations that use them', () => {
    expect(
      css('@keyframes spin { from { opacity: 0 } } a { animation: spin 1s; transition: spin }'),
    ).toBe(
      '@keyframes spin-x { from { opacity: 0 } } a[s-x] { animation: spin-x 1s; transition: spin }',
    );
  });

  it('keeps the escapes of the source', () => {
    expect(css('q::before { content: "\\201C" }')).toBe('q[s-x]::before { content: "\\201C" }');
  });
});

describe('variables', () => {
  it('replaces interpolations with CSS variables', () => {
    expect(css('a { color: ${color}; margin: ${size}px ${size * 2}px }')).toBe(
      'a[s-x] { color: var(--s-x-0); margin: var(--s-x-1) var(--s-x-2) }',
    );
  });

  it('ignores interpolations in comments', () => {
    expect(css('/* ${color} */ a { color: ${color} }')).toBe(
      '/* ${color} */ a[s-x] { color: var(--s-x-0) }',
    );
  });

  it('moves the rest of the CSS token into the variable value', () => {
    const { code } = compile(
      '<style>a { margin: ${size}px; color: #${hex}; width: calc(100% - ${w}px) }</style><a />',
      { scope: 'x' },
    );
    expect(code).toContain("'--s-x-0': `${(\nsize\n)}px`,");
    expect(code).toContain("'--s-x-1': `#${(\nhex\n)}`,");
    expect(code).toContain("'--s-x-2': `${(\nw\n)}px`,");
  });

  it('sets the variables on scoped elements', () => {
    const { code } = compile('<style>a { color: ${color} }</style><a href="#" />', {
      scope: 'x',
    });
    expect(code).not.toContain('solid-sfc/runtime');
    expect(code).toContain("'--s-x-0': (\ncolor\n),");
    expect(code).toContain('<a s-x href="#" style={__styleVariables()} />');
  });

  it.each([
    [
      '<a style="color: red" />',
      '<a s-x style={__mergeStyle("color: red", __styleVariables())} />',
    ],
    [
      "<a style={ color: 'red' } />",
      "<a s-x style={__mergeStyle(({ color: 'red' }), __styleVariables())} />",
    ],
    ['<a style=(s()) />', '<a s-x style={__mergeStyle((s()), __styleVariables())} />'],
    ['<a {style} />', '<a s-x style={__mergeStyle(style, __styleVariables())} />'],
    ['<input value=x>', '<input s-x value={x} style={__styleVariables()}/>'],
  ])('merges %s', (input, output) => {
    expect(markup(`<style>a { color: \${c} }</style>${input}`)).toBe(output);
  });

  it('imports the merge helper when needed', () => {
    const { code } = compile('<style>a { color: ${c} }</style><a style="" />');
    expect(code).toContain("import { mergeStyle as __mergeStyle } from 'solid-sfc/runtime';");
  });

  it.each([
    ['a { ${prop}: red }', 'only allowed in declaration values'],
    ['@media (width > ${w}) { a { color: red } }', 'only allowed in declaration values'],
    ['a { color: ${} }', 'Empty interpolation'],
    ['a { color: red', 'Unclosed block'],
  ])('rejects %s', (input, message) => {
    expect(() => compile(`<style>${input}</style>`)).toThrow(message);
  });

  it('rejects interpolations in global styles', () => {
    expect(() => compile('<style global>a { color: ${c} }</style>')).toThrow(
      'A global style cannot have interpolations',
    );
  });
});

describe('markup', () => {
  it('adds the scope attribute to native elements only', () => {
    expect(
      markup('<style>a {}</style><div><Comp /><svg:rect /><my-el>{x && <b />}</my-el></div>'),
    ).toBe('<div s-x><Comp /><svg:rect /><my-el s-x>{x && <b s-x />}</my-el></div>');
  });

  it('adds the scope attribute to dynamic tags', () => {
    expect(markup('<style>a {}</style><{tag}>x</>')).toBe(
      '{(() => { const __Tag = __dynamic(() => tag); return <__Tag s-x>x</__Tag>; })()}',
    );
  });

  it('does not scope markup when every style is global', () => {
    expect(markup('<style global>a {}</style><div />')).toBe('<div />');
  });

  it('keeps shorthand attributes valid', () => {
    expect(markup('<style>a {}</style><a{href} />')).toBe('<a s-x href={href} />');
  });

  it('uses a stable scope per filename', () => {
    const a = compile('<style>a {}</style>', { filename: 'A.solid' }).css?.code;
    const b = compile('<style>a { }</style>', { filename: 'A.solid' }).css?.code;
    expect(a?.split('{')[0]).toBe(b?.split('{')[0]);
  });

  it('maps the CSS to the file', () => {
    const { css: result } = compile('<p />\n\n<style>\na { color: red }\n</style>', {
      filename: 'Map.solid',
    });
    expect(result?.map.sources).toEqual(['Map.solid']);
    // The rule starts on line 4 of the file.
    expect(result?.map.mappings.startsWith('AAGA')).toBe(true);
  });
});

function warnings(template: string): string[] {
  return compile(template, { scope: 'x' }).warnings.map(
    (warning) => `${warning.line}:${warning.column} ${warning.message}`,
  );
}

describe('unused selectors', () => {
  it('warns about selectors that no element matches', () => {
    expect(
      warnings('<style>\n.a { }\n.b, p.a { }\n#c { }\nli { }\n</style>\n<div class="a" id="d" />'),
    ).toEqual([
      '3:1 Unused CSS selector ".b"',
      '3:5 Unused CSS selector "p.a"',
      '4:1 Unused CSS selector "#c"',
      '5:1 Unused CSS selector "li"',
    ]);
  });

  it('lets a dynamic tag match any tag', () => {
    expect(warnings('<style>li.a { } .b { }</style><{tag} class="a" />')).toEqual([
      '1:17 Unused CSS selector ".b"',
    ]);
  });

  it('only checks the scoped part of a selector', () => {
    expect(warnings('<style>.outside .a { } :global(.x) .a { }</style><p class="a" />')).toEqual(
      [],
    );
  });

  it('reads the keys of object literal classes', () => {
    expect(
      warnings("<style>.on.open { } .off { }</style><p class={ on: a, 'open': b } />"),
    ).toEqual(['1:21 Unused CSS selector ".off"']);
  });

  it('treats expressions and spreads as any class or id', () => {
    expect(warnings('<style>.a { } #b { }</style><p class=(name) {...props} />')).toEqual([]);
    expect(warnings('<style>.a { }</style><p class=cls />')).toEqual([]);
  });

  it('ignores components, global styles and comments', () => {
    expect(
      warnings('<style>/* .x { } */ .a { }</style><style global>.b { }</style><Comp class="a" />'),
    ).toEqual(['1:21 Unused CSS selector ".a"']);
  });

  it('checks nested and at-rule selectors', () => {
    expect(warnings('<style>.a { .b { } } @media print { .c { } }</style><p class="a" />')).toEqual(
      ['1:13 Unused CSS selector ".b"', '1:37 Unused CSS selector ".c"'],
    );
  });
});

describe('preprocessors', () => {
  it('scopes SCSS at the start of compounds, so suffixes join the parent', () => {
    const { css: stylesheet } = compile(
      '<style lang="scss">\n.card { &__title { } .body { } }\np { }\n%shared { }\n</style><p class="card card__title body" />',
      { scope: 'x' },
    );
    expect(stylesheet?.lang).toBe('scss');
    expect(stylesheet?.code).toBe(
      '[s-x].card { &__title { } [s-x].body { } }\n\np[s-x] { }\n\n%shared { }\n',
    );
  });

  it('keeps SCSS line comments and replaces interpolations', () => {
    const { css: stylesheet } = compile(
      '<style lang="scss">\n// ${a}\n$c: 1;\np { margin: ${a}px; }\n</style><p />',
      {
        scope: 'x',
      },
    );
    expect(stylesheet?.code).toContain('// ${a}');
    expect(stylesheet?.code).toContain('p[s-x] { margin: var(--s-x-0); }');
  });

  it('does not scope Less mixins', () => {
    const { css: stylesheet } = compile(
      '<style lang="less">\n.mixin() { }\n.a { .mixin(); }\n</style><p class="a" />',
      { scope: 'x' },
    );
    expect(stylesheet?.code).toBe('.mixin() { }\n\n[s-x].a { .mixin(); }\n');
  });

  it('does not check selectors that a preprocessor builds', () => {
    const result = compile('<style lang="scss">.btn-#{$c} { } %p { }</style><p />', {
      scope: 'x',
    });
    expect(result.warnings).toEqual([]);
  });

  it.each([
    [
      '<style lang="scss"></style><style></style>',
      'All <style> blocks of a file must have the same lang',
    ],
    ['<style lang="stylus"></style>', 'Unsupported style lang "stylus"'],
  ])('rejects %s', (input, message) => {
    expect(() => compile(input)).toThrow(message);
  });
});
