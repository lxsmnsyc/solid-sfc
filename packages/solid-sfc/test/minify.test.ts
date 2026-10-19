import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { minifyCSS } from '../src/minify.ts';

describe('minifyCSS', () => {
  it.each([
    ['/* note */ a { color: red; }', 'a{color:red}'],
    ['.a  >  .b ,\n\t.c ~ .d + .e { margin : 0  auto ; }', '.a>.b,.c~.d+.e{margin:0 auto}'],
    ['.a :hover { color: red }', '.a :hover{color:red}'],
    ['li:nth-child( 2n + 1 ) { color: red }', 'li:nth-child(2n+1){color:red}'],
    ['a { color: red !important; }', 'a{color:red!important}'],
    [
      'a { color: rgba( 0 , 0 , 0 , 0.5 ); width: calc(100% - 2px) }',
      'a{color:rgba(0,0,0,0.5);width:calc(100% - 2px)}',
    ],
    ['[title="a  b"] { content: "x  , y" }', '[title="a  b"]{content:"x  , y"}'],
    [
      '@media (max-width: 40rem) and ( min-width : 1px ) { a { color: red } }',
      '@media (max-width:40rem) and (min-width:1px){a{color:red}}',
    ],
    ['@keyframes k { from { opacity: 0 } }', '@keyframes k{from{opacity:0}}'],
  ])('minifies %s', (input, output) => {
    expect(minifyCSS(input)).toBe(output);
  });
});

describe('compiled stylesheets', () => {
  const source = '<style>\n  p {\n    color: red;\n  }\n</style><p />';

  it('are minified', () => {
    const { code } = compile(source, { scope: 'x' });
    expect(code).toContain('const __stylesheet = "p[s-x]{color:red}";');
  });

  it('keep their whitespace in dev', () => {
    const { code } = compile(source, { scope: 'x', dev: true });
    expect(code).toContain('color: red;');
  });
});
