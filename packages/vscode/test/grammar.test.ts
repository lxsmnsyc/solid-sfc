import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadWASM, OnigScanner, OnigString } from 'vscode-oniguruma';
import { INITIAL, Registry, parseRawGrammar } from 'vscode-textmate';
import type { IGrammar } from 'vscode-textmate';

const require = createRequire(import.meta.url);
let grammar: IGrammar;

beforeAll(async () => {
  await loadWASM(readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm')).buffer);
  const registry = new Registry({
    onigLib: Promise.resolve({
      createOnigScanner: (patterns) => new OnigScanner(patterns),
      createOnigString: (text) => new OnigString(text),
    }),
    // VS Code provides the TSX and CSS grammars. Empty grammars stand in for
    // them, and this grammar's `contentName` still sets the embedded scopes.
    loadGrammar: async (scopeName) =>
      scopeName === 'source.solid'
        ? parseRawGrammar(
            readFileSync(new URL('../syntaxes/solid.tmLanguage.json', import.meta.url), 'utf8'),
            'solid.tmLanguage.json',
          )
        : parseRawGrammar(JSON.stringify({ scopeName, patterns: [] }), `${scopeName}.json`),
  });
  const loaded = await registry.loadGrammar('source.solid');
  if (!loaded) {
    throw new Error('The grammar did not load');
  }
  grammar = loaded;
});

/** Returns the scopes of each token, keyed by the token text. */
function tokenize(source: string): Map<string, string[]>[] {
  let state = INITIAL;
  return source.split('\n').map((line) => {
    const result = grammar.tokenizeLine(line, state);
    state = result.ruleStack;
    const tokens = new Map<string, string[]>();
    for (const token of result.tokens) {
      const text = line.slice(token.startIndex, token.endIndex);
      if (text.trim() && !tokens.has(text.trim())) {
        tokens.set(text.trim(), token.scopes);
      }
    }
    return tokens;
  });
}

function scopeOf(source: string, line: number, text: string): string[] {
  const scopes = tokenize(source)[line]?.get(text);
  if (!scopes) {
    throw new Error(`No token "${text}" on line ${line}`);
  }
  return scopes;
}

describe('blocks', () => {
  it('embeds TSX in <script>', () => {
    const source = '<script lang="ts">\n  let a = 1;\n</script>';
    expect(scopeOf(source, 0, 'script')).toContain('entity.name.tag.script.solid');
    expect(scopeOf(source, 0, 'lang')).toContain('entity.other.attribute-name.solid');
    expect(scopeOf(source, 1, 'let a = 1;')).toContain('source.tsx');
  });

  it('embeds CSS in <style> and TSX in interpolations', () => {
    const source = '<style>\n  a { color: ${color}; }\n</style>';
    expect(scopeOf(source, 1, 'a { color:')).toContain('source.css');
    expect(scopeOf(source, 1, 'color')).toContain('meta.embedded.expression.tsx');
  });

  it('embeds SCSS and Less by lang', () => {
    expect(scopeOf('<style lang="scss">\n  a { b {} }\n</style>', 1, 'a { b {} }')).toContain(
      'source.css.scss',
    );
    expect(scopeOf("<style lang='less'>\n  a { b {} }\n</style>", 1, 'a { b {} }')).toContain(
      'source.css.less',
    );
  });
});

describe('markup', () => {
  it('scopes tags and components', () => {
    const source = '<div class="a"><Item /></div>';
    expect(scopeOf(source, 0, 'div')).toContain('entity.name.tag.solid');
    expect(scopeOf(source, 0, 'Item')).toContain('support.class.component.solid');
    expect(scopeOf(source, 0, 'class')).toContain('entity.other.attribute-name.solid');
    expect(scopeOf(source, 0, '"a"')).toContain('string.quoted.double.solid');
  });

  it('scopes attribute values without braces', () => {
    const source = '<button onClick=increment tabIndex=0 disabled=false title=(a + b) />';
    expect(scopeOf(source, 0, 'increment')).toContain('variable.other.readwrite.solid');
    expect(scopeOf(source, 0, '0')).toContain('constant.numeric.solid');
    expect(scopeOf(source, 0, 'false')).toContain('constant.language.solid');
    expect(scopeOf(source, 0, 'a + b')).toContain('meta.embedded.expression.tsx');
  });

  it('scopes calls and member accesses in attribute values', () => {
    const source = '<b onClick=props.select(item.id) value=!items[0]?.label next />';
    expect(scopeOf(source, 0, 'select')).toContain('entity.name.function.solid');
    expect(scopeOf(source, 0, 'item.id')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 0, '!')).toContain('keyword.operator.solid');
    expect(scopeOf(source, 0, 'label')).toContain('variable.other.readwrite.solid');
    expect(scopeOf(source, 0, 'next')).toContain('entity.other.attribute-name.solid');
  });

  it('embeds TSX in expressions with nested braces', () => {
    const source = '<p>{fn({ a: 1 })} text</p>';
    expect(scopeOf(source, 0, 'fn(')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 0, 'text')).not.toContain('meta.embedded.expression.tsx');
  });

  it('scopes comments', () => {
    expect(scopeOf('<!-- note -->', 0, 'note')).toContain('comment.block.solid');
  });
});

describe('control flow', () => {
  it('scopes keywords, headers and bodies', () => {
    const source = '#if (user) {\n  <p />\n} #else {\n  <q />\n}';
    expect(scopeOf(source, 0, '#')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 0, 'if')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 0, 'user')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 1, 'p')).toContain('entity.name.tag.solid');
    expect(scopeOf(source, 2, 'else')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 3, 'q')).toContain('entity.name.tag.solid');
  });

  it('scopes `of` and `by` in loop headers', () => {
    const source = '#for (item, index of items by item.id) { <li /> }';
    expect(scopeOf(source, 0, 'of')).toContain('keyword.operator.expression.of.solid');
    expect(scopeOf(source, 0, 'by')).toContain('keyword.operator.expression.by.solid');
    expect(scopeOf(source, 0, 'li')).toContain('entity.name.tag.solid');
  });

  it('scopes blocks with optional headers', () => {
    const source = "#reveal ('sequential') {\n  #loading (id) { <a /> }\n}\n#portal { <b /> }";
    expect(scopeOf(source, 0, 'reveal')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 0, "'sequential'")).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 1, 'id')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 3, 'portal')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 3, 'b')).toContain('entity.name.tag.solid');
  });

  it('scopes #const declarations', () => {
    const source = '#for (item of items) {\n  #const total = item.price * 2;\n  <p />\n}';
    expect(scopeOf(source, 1, 'const')).toContain('storage.type.solid');
    expect(scopeOf(source, 1, 'total = item.price * 2')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 2, 'p')).toContain('entity.name.tag.solid');
  });

  it('scopes #template declarations', () => {
    const source = '#template row(user, index) {\n  <tr />\n}';
    expect(scopeOf(source, 0, 'template')).toContain('storage.type.solid');
    expect(scopeOf(source, 0, 'row')).toContain('entity.name.function.solid');
    expect(scopeOf(source, 0, 'user, index')).toContain('meta.embedded.expression.tsx');
    expect(scopeOf(source, 1, 'tr')).toContain('entity.name.tag.solid');
  });

  it('nests blocks', () => {
    const source = '#if (a) {\n  #for (x of xs) {\n    <b />\n  }\n}\n<c />';
    expect(scopeOf(source, 1, 'for')).toContain('keyword.control.flow.solid');
    expect(scopeOf(source, 2, 'b')).toContain('entity.name.tag.solid');
    expect(scopeOf(source, 5, 'c')).toContain('entity.name.tag.solid');
  });

  it('leaves other # text alone', () => {
    const source = '<p>C# and #hashtag and (a) {b}</p>';
    expect(scopeOf(source, 0, 'C# and #hashtag and (a)')).not.toContain(
      'keyword.control.flow.solid',
    );
    expect(scopeOf(source, 0, 'b')).toContain('meta.embedded.expression.tsx');
  });
});
