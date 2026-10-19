import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

function codes(template: string): string[] {
  return compile(template).warnings.map((warning) => warning.code);
}

describe('accessibility', () => {
  it.each([
    ['<img src="a.png">', ['a11y-missing-alt']],
    ['<{tag} onClick=go role="nope" />', []],
    ['<img src="a.png" alt="">', []],
    ['<iframe src="x" />', ['a11y-missing-title']],
    ['<a>Link</a>', ['a11y-missing-href']],
    ['<a href=url>Link</a>', []],
    ['<div onClick=go />', ['a11y-click-events']],
    ['<div onClick=go onKeyDown=key />', []],
    ['<div onClick=go aria-hidden="true" />', []],
    ['<button onClick=go />', []],
    ['<span role="button" />', ['a11y-interactive-focus']],
    ['<span role="button" tabIndex=0 />', []],
    ['<p role="buton" />', ['a11y-unknown-role']],
    ['<p role="doc-abstract" />', []],
    ['<p aria-lable="x" />', ['a11y-unknown-aria']],
    ['<p aria-label="x" />', []],
    ['<p tabIndex=1 />', ['a11y-positive-tabindex']],
    ['<p tabIndex="-1" />', []],
    ['<p accessKey="s" />', ['a11y-accesskey']],
    ['<input autofocus>', ['a11y-autofocus']],
    ['<Img src="a.png" />', []],
  ])('%s', (template, expected) => {
    expect(codes(template)).toEqual(expected);
  });

  it('assumes that a spread can set any attribute', () => {
    expect(codes('<img {...props}>')).toEqual([]);
    expect(codes('<a [name]=value>Link</a>')).toEqual([]);
  });

  it('turns off codes with a comment before the element', () => {
    expect(codes('<!-- solid-sfc-ignore a11y-missing-alt -->\n<img src="a.png">')).toEqual([]);
    expect(
      codes(
        '<!-- solid-sfc-ignore a11y-click-events, a11y-unknown-role --><p onClick=go role="x" />',
      ),
    ).toEqual([]);
    expect(codes('<!-- solid-sfc-ignore a11y-missing-alt --><p /><img src="a.png">')).toEqual([
      'a11y-missing-alt',
    ]);
  });

  it('reports the location of the element', () => {
    expect(compile('<div>\n  <img src="a.png">\n</div>').warnings[0]).toMatchObject({
      line: 2,
      column: 3,
      length: 4,
    });
  });
});
