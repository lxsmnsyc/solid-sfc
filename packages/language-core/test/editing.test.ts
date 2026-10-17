import { describe, expect, it } from 'vitest';
import { getCodeActions, getCompletions } from '../src/index.ts';

/** Completions at the `|` in `text`. */
function complete(text: string): string[] {
  const offset = text.indexOf('|');
  return getCompletions(text.replace('|', ''), offset).map((item) => item.label);
}

/** Applies the edits of the code action with `title` to `text`, whose selection is `[` to `]`. */
function act(text: string, title: string): string | undefined {
  const start = text.indexOf('[');
  const end = text.indexOf(']') - 1;
  const source = text.replace('[', '').replace(']', '');
  const action = getCodeActions(source, start, end).find((item) => item.title === title);
  if (!action) {
    return undefined;
  }
  let result = source;
  for (const edit of action.edits.toSorted((a, b) => b.start - a.start)) {
    result = result.slice(0, edit.start) + edit.text + result.slice(edit.end);
  }
  return result;
}

describe('completions', () => {
  it('completes control flow keywords in markup', () => {
    expect(complete('<div>\n  #|\n</div>')).toContain('#if');
    expect(complete('<div>\n  #fo|\n</div>')).toContain('#for');
    expect(complete('#if (a) {\n} #el|')).toContain('#else');
  });

  it('completes solid: elements', () => {
    expect(complete('<solid:|')).toEqual(['window', 'document', 'hydration-script']);
  });

  it('replaces the typed keyword', () => {
    const [item] = getCompletions('<p>\n  #i', 8);
    expect(item?.start).toBe(6);
    expect(item?.snippet).toBe('#if (${1:condition}) {\n\t$0\n}');
  });

  it('does not complete in scripts, styles, comments or words', () => {
    expect(complete('<script>\n  class A { #|\n</script>')).toEqual([]);
    expect(complete('<style>\n  #|\n</style>')).toEqual([]);
    expect(complete('<!-- #| -->')).toEqual([]);
    expect(complete('<p>a#|</p>')).toEqual([]);
    expect(complete('#if (a) {\n  <script>\n    #|\n  </script>\n}')).toEqual([]);
  });
});

describe('code actions', () => {
  it('wraps lines in a block', () => {
    expect(act('<ul>\n  [<li>a</li>\n  <li>b</li>]\n</ul>', 'Wrap in #if')).toBe(
      '<ul>\n  #if (condition) {\n    <li>a</li>\n    <li>b</li>\n  }\n</ul>',
    );
    expect(act('[<p>a</p>]', 'Wrap in #for')).toBe('#for (item of list) {\n  <p>a</p>\n}');
  });

  it('extracts markup to a template at the end of the file', () => {
    expect(act('<div>\n  [<p>a</p>]\n</div>\n', 'Extract to #template')).toBe(
      '<div>\n  {extracted()}\n</div>\n\n#template extracted() {\n  <p>a</p>\n}\n',
    );
  });

  it('extracts markup in a block to a template of that block', () => {
    expect(
      act(
        '#for (item of items) {\n  <li>\n    [<b>{item}</b>]\n  </li>\n}',
        'Extract to #template',
      ),
    ).toBe(
      '#for (item of items) {\n  #template extracted() {\n    <b>{item}</b>\n  }\n  <li>\n    {extracted()}\n  </li>\n}',
    );
  });

  it('picks a name that the file does not use', () => {
    expect(act('<p>{extracted}</p>\n[<b />]', 'Extract to #template')).toContain(
      '#template extracted2()',
    );
  });

  it('has no actions in scripts or for an empty selection', () => {
    expect(getCodeActions('<script>\n  let a = 1;\n</script>', 12, 20)).toEqual([]);
    expect(getCodeActions('<p />', 2, 2)).toEqual([]);
  });
});
