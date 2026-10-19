import type { CodeMapping, IScriptSnapshot, VirtualCode } from '@volar/language-core';
import { describe, expect, it } from 'vitest';
import {
  createSolidLanguagePlugin,
  compileForEditor,
  createSolidVirtualCode,
  getClosingTag,
  getDocumentSymbols,
  getFoldingRanges,
} from '../src/index.ts';

function snapshot(text: string): IScriptSnapshot {
  return {
    getText: (start, end) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

function textOf(code: VirtualCode): string {
  return code.snapshot.getText(0, code.snapshot.getLength());
}

function embedded(source: string, id: string): VirtualCode {
  const root = createSolidVirtualCode('/src/App.solid', snapshot(source));
  const code = root.embeddedCodes?.find((item) => item.id === id);
  if (!code) {
    throw new Error(`Missing ${id}`);
  }
  return code;
}

/** Maps a generated offset back to the source, or returns undefined. */
function toSource(mappings: CodeMapping[], offset: number): number | undefined {
  for (const mapping of mappings) {
    const generated = mapping.generatedOffsets[0]!;
    if (offset >= generated && offset < generated + mapping.lengths[0]!) {
      return mapping.sourceOffsets[0]! + offset - generated;
    }
  }
  return undefined;
}

/**
 * Returns the source text of every mapped occurrence of `word` in the
 * generated code. A correct mapping returns `word` each time.
 */
function mappedWords(code: VirtualCode, source: string, word: string): string[] {
  const generated = textOf(code);
  const words: string[] = [];
  let index = generated.indexOf(word);
  while (index !== -1) {
    const start = toSource(code.mappings, index);
    const end = toSource(code.mappings, index + word.length - 1);
    if (start !== undefined) {
      words.push(end === start + word.length - 1 ? source.slice(start, end + 1) : '<split>');
    }
    index = generated.indexOf(word, index + 1);
  }
  return words;
}

const source = `<script lang="ts">
  import Item from './Item.solid';
  interface Props { label: string }
  const { label } = $props<Props>();
  let count = $signal(0);
  function increment() { count += 1; }
</script>

<style>
  button { color: \${count > 3 ? 'red' : 'blue'}; }
</style>

<button onClick=increment title=(label)>{count}</button>
#for (item of items) { <Item value=item /> }
`;

describe('tsx', () => {
  it('starts with the prelude', () => {
    const code = embedded(source, 'tsx');
    expect(textOf(code)).toMatch(
      /^\/\/\/ <reference types="solid-sfc\/client" \/>\n\/\*\* @jsxImportSource @solidjs\/web \*\/\n/,
    );
    expect(code.languageId).toBe('typescriptreact');
  });

  it('maps script identifiers', () => {
    const code = embedded(source, 'tsx');
    // The parameter type is generated text, so only the interface maps.
    expect(mappedWords(code, source, 'Props')).toEqual(Array(1).fill('Props'));
    expect(mappedWords(code, source, 'increment')).toEqual(Array(2).fill('increment'));
  });

  it('maps markup and style expressions', () => {
    const code = embedded(source, 'tsx');
    // Script, style interpolation and markup.
    expect(mappedWords(code, source, 'count')).toEqual(Array(4).fill('count'));
    expect(mappedWords(code, source, 'label')).toEqual(Array(3).fill('label'));
    expect(mappedWords(code, source, 'items')).toEqual(Array(1).fill('items'));
  });

  it('keeps the props type', () => {
    expect(textOf(embedded(source, 'tsx'))).toContain('function App($$props: Props)');
  });

  it('maps the props that blocks generate to their values', () => {
    const input = '#for (item of items) { <p /> }\n#reveal (order) { <p /> }';
    const code = embedded(input, 'tsx');
    const text = textOf(code);
    const props = code.mappings.filter((mapping) => mapping.generatedLengths);
    expect(
      props.map((mapping) => [
        text.slice(
          mapping.generatedOffsets[0],
          mapping.generatedOffsets[0]! + mapping.generatedLengths![0]!,
        ),
        input.slice(mapping.sourceOffsets[0], mapping.sourceOffsets[0]! + mapping.lengths[0]!),
      ]),
    ).toEqual([
      ['each', 'items'],
      ['order', 'order'],
    ]);
    expect(props[0]!.data).toEqual({ verification: true });
  });

  it('turns off folding where the generated code replaces the file', () => {
    const code = embedded('#for (item of items) { <p /> }', 'tsx');
    const text = textOf(code);
    const start = code.mappings.find((mapping) =>
      text.startsWith('<For', mapping.generatedOffsets[0]),
    );
    expect(start?.data.structure).toBe(false);
    const items = code.mappings.find((mapping) =>
      text.startsWith('items', mapping.generatedOffsets[0]),
    );
    expect(items?.data.structure).toBe(true);
  });

  it('falls back to the scripts when the markup has an error', () => {
    const errors: string[] = [];
    const broken = '<script>let a: number = 1;</script>\n#if () { }';
    const root = createSolidVirtualCode('/src/A.solid', snapshot(broken), {
      onError: (_fileName, error) => errors.push(error.message),
    });
    const code = root.embeddedCodes!.find((item) => item.id === 'tsx')!;
    expect(textOf(code)).toContain('let a: number = 1;');
    expect(mappedWords(code, broken, 'number')).toEqual(Array(1).fill('number'));
    expect(errors).toEqual(['Expected an expression after #if (/src/A.solid:2:5)']);
  });
});

describe('css', () => {
  it('creates one CSS document per style block', () => {
    const code = embedded(source, 'style_0');
    expect(code.languageId).toBe('css');
    const css = source.slice(source.indexOf('<style>') + 7, source.indexOf('</style>'));
    const interpolation = "${count > 3 ? 'red' : 'blue'}";
    expect(textOf(code)).toBe(css.replace(interpolation, 'x'.padEnd(interpolation.length, '_')));
  });

  it('uses the lang of the block and skips line comments', () => {
    const code = embedded(
      '<style lang="scss">// ${a}\np { color: ${a} }</style>\n<p />',
      'style_0',
    );
    expect(code.languageId).toBe('scss');
    expect(textOf(code)).toBe('// ${a}\np { color: x___ }');
  });

  it('keeps interpolations in comments', () => {
    const code = embedded('<style>/* ${a} */ p { color: ${a} }</style>\n<p />', 'style_0');
    expect(textOf(code)).toBe('/* ${a} */ p { color: x___ }');
  });
});

/** Each range as its first and last folded line, starting at 1. */
function folds(text: string): string[] {
  const line = (offset: number) => text.slice(0, offset).split('\n').length;
  return getFoldingRanges(text)
    .map((range) => `${line(range.start)}-${line(range.end)}${range.kind ? ` ${range.kind}` : ''}`)
    .filter((range) => !/^(\d+)-\1\b/.test(range));
}

describe('folding', () => {
  it('folds scripts, styles, comments and blocks', () => {
    const input = [
      '<script>',
      '  let a = 1;',
      '</script>',
      '<style>',
      '  p { color: red; }',
      '</style>',
      '<!--',
      '  note',
      '-->',
      '#if (a) {',
      '  <p />',
      '  } #else {',
      '  <q />',
      '}',
    ].join('\n');
    expect(folds(input)).toEqual(['1-2', '4-5', '7-9 comment', '10-11', '12-13']);
  });

  it('ignores comments in scripts and blocks on one line', () => {
    expect(folds('<script>\n  const a = "<!--\n-->";\n</script>\n#if (a) { <p /> }')).toEqual([
      '1-3',
    ]);
  });

  it('keeps the script and style ranges when the markup has an error', () => {
    expect(folds('<script>\n  let a;\n</script>\n<div>\n')).toEqual(['1-2']);
  });
});

/** The closing tag to insert after the end of `text`. */
function close(text: string): string | undefined {
  return getClosingTag(text, text.length);
}

describe('outline', () => {
  it('lists blocks, script declarations and templates, reading scripts as TypeScript', () => {
    const file = [
      '<script>',
      '  interface Props { a: string }',
      '  const { a } = $props<Props>();',
      '  let count = $signal(0);',
      '  function increment() {}',
      '</script>',
      '<style lang="scss">p {}</style>',
      '<p>{row(1)}</p>',
      '#template row(n: number) { <i>{n}</i> }',
    ].join('\n');
    const symbols = getDocumentSymbols(file);
    expect(symbols.map((symbol) => [symbol.name, symbol.kind])).toEqual([
      ['<script>', 'module'],
      ['<style lang="scss">', 'module'],
      ['row', 'function'],
    ]);
    expect(symbols[0]!.children.map((symbol) => [symbol.name, symbol.kind])).toEqual([
      ['Props', 'interface'],
      ['{ a }', 'constant'],
      ['count', 'variable'],
      ['increment', 'function'],
    ]);
    const count = symbols[0]!.children[2]!;
    expect(file.slice(count.selectionStart, count.selectionEnd)).toBe('count');
  });
});

describe('markup in scripts', () => {
  it('keeps the declarations around it in the outline', () => {
    const file =
      '<script>\n  const icon = <Icon size=16 />;\n  function row(item: string) {\n    return <li title=item>{item}</li>;\n  }\n</script>\n{icon}';
    expect(getDocumentSymbols(file)[0]!.children.map((symbol) => symbol.name)).toEqual([
      'icon',
      'row',
    ]);
  });

  it('masks it in the fallback script', () => {
    const file = `<script>\n  const icon = <Icon size=16 />;\n</script>\n${UNRECOVERABLE}`;
    const text = textOf(embedded(file, 'tsx'));
    expect(text).toContain('const icon = null');
    expect(text).not.toContain('size=16');
  });
});

/** More broken lines than the editor blanks before it gives up on the markup. */
const UNRECOVERABLE = '<a b=c+d />\n'.repeat(10);

describe('scripts of blocks', () => {
  it('leaves them out of the outline and the fallback script', () => {
    const file = `<script>\n  let a = 1;\n</script>\n#if (a) {\n  <script>\n    let b = 2;\n  </script>\n  <p>{b}</p>\n}\n${UNRECOVERABLE}`;
    expect(getDocumentSymbols(file).map((symbol) => symbol.name)).toEqual(['<script>']);
    const code = embedded(file, 'tsx');
    expect(textOf(code)).toContain('let a = 1;');
    expect(textOf(code)).not.toContain('let b = 2;');
  });
});

describe('recovery from syntax errors', () => {
  const script = '<script>\n  let count = $signal(0);\n</script>\n';

  it.each([
    ['an unfinished tag', '<div>\n  <butt\n  <p>{count}</p>\n</div>'],
    ['an unfinished attribute', '<div>\n  <input value= />\n  <p>{count}</p>\n</div>'],
    ['an unclosed element', '<div>\n  <section>\n  <p>{count}</p>\n</div>'],
    ['an element closed at the end of the file', '<div>\n  <p>{count}</p>'],
    ['a stray closing tag', '<p>{count}</p>\n</span>'],
    ['an unclosed block', '#if (count > 1) {\n  <p>{count}</p>'],
    ['an unfinished expression', '<p>{count}</p>\n<p>{count.</p>'],
    ['a syntax error in the script', '<p>{count}</p>'],
  ])('keeps the markup typed with %s', (name, markup) => {
    const file =
      name === 'a syntax error in the script'
        ? `<script>\n  let count = $signal(0);\n  const x = ;\n</script>\n${markup}`
        : script + markup;
    const { result, error } = compileForEditor(file);
    expect(error).toBeDefined();
    expect(result?.code).toContain('{count}');
  });

  it('returns no error for a valid file', () => {
    const { result, error } = compileForEditor(`${script}<p>{count}</p>`);
    expect(error).toBeUndefined();
    expect(result).toBeDefined();
  });

  it('maps the markup of a broken file', () => {
    const code = embedded(`${script}<p>{count}</p>\n<butt`, 'tsx');
    expect(textOf(code)).toContain('{count}');
  });
});

describe('closing tags', () => {
  it.each([
    ['<div>', '</div>'],
    ['<p>text</p><Card title="a > b" onClick=(() => a > b)>', '</Card>'],
    ['<>', '</>'],
    ['<solid:hydration-script>', '</solid:hydration-script>'],
    ['<{props.as ?? "div"} class={ a: b }>', '</>'],
  ])('closes %s', (text, tag) => {
    expect(close(text)).toBe(tag);
  });

  it.each([
    '<br>',
    '<img src="a">',
    '<div />',
    '</div>',
    'a > b',
    '<script>if (a <b>',
    '<style>a > b',
  ])('does not close %s', (text) => {
    expect(close(text)).toBeUndefined();
  });
});

describe('plugin', () => {
  const plugin = createSolidLanguagePlugin<string>();

  it('handles .solid files only', () => {
    expect(plugin.getLanguageId('/a/App.solid')).toBe('solid');
    expect(plugin.getLanguageId('/a/App.tsx')).toBeUndefined();
  });

  it('exposes the TSX code to TypeScript', () => {
    const root = plugin.createVirtualCode!('/a/App.solid', 'solid', snapshot(source), {
      getAssociatedScript: () => undefined,
    })!;
    const script = plugin.typescript!.getServiceScript(root);
    expect(script?.extension).toBe('.tsx');
    expect(script?.code.id).toBe('tsx');
  });
});
