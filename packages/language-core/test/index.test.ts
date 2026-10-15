import type { CodeMapping, IScriptSnapshot, VirtualCode } from '@volar/language-core';
import { describe, expect, it } from 'vitest';
import { createSolidLanguagePlugin, createSolidVirtualCode } from '../src/index.ts';

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

  it('keeps interpolations in comments', () => {
    const code = embedded('<style>/* ${a} */ p { color: ${a} }</style>\n<p />', 'style_0');
    expect(textOf(code)).toBe('/* ${a} */ p { color: x___ }');
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
