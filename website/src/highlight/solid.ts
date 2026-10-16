/**
 * A twinkleplop language for `.solid` files: HTML-like markup with `{…}`
 * expressions, attribute values without quotes, control flow blocks such as
 * `#if (a) { … }`, dynamic tags `<{tag}>`, and `<script>` and `<style>`
 * blocks. Scripts and expressions are highlighted as TSX, styles as CSS.
 *
 * Like the Svelte grammar of twinkleplop, it marks the raw text of scripts,
 * styles and expressions, and a reclassifier hands each one to its language.
 */
import {
  always,
  create_language,
  embed_grammars,
  enter,
  fallback,
  goto,
  keyword,
  leave,
  match,
  on,
  range,
  to_html,
  within,
} from '@twinkleplop/core';
import type { LanguageOptions, RenderOptions } from '@twinkleplop/core';
import { compile, define_grammar } from '@twinkleplop/core/compile';
import * as TOKENS from '@twinkleplop/core/tokens';
import { tokenize as css } from '@twinkleplop/css';
import { tokenize as tsx } from '@twinkleplop/tsx';

const WHITESPACE = [' ', '\t', '\n', '\r'];

const TAG_NAME_CHARS = range([
  ['a', 'z'],
  ['A', 'Z'],
  ['0', '9'],
  ['-', '-'],
  ['_', '_'],
  [':', ':'],
  ['.', '.'],
  ['$', '$'],
]);

const WORD_CHARS = range([
  ['a', 'z'],
  ['A', 'Z'],
  ['0', '9'],
  ['_', '_'],
  ['$', '$'],
]);

const ASCII_ALPHA = range([
  ['a', 'z'],
  ['A', 'Z'],
]);

const ATTR_NAME_CHARS = range([
  ['a', 'z'],
  ['A', 'Z'],
  ['0', '9'],
  ['-', '-'],
  ['_', '_'],
  ['$', '$'],
]);

// The characters of an attribute value without quotes, such as
// `props.items[0]`. Whitespace, `>` and `/` end it.
const BARE_VALUE_CHARS = range([
  ['!', '!'],
  ['#', '&'],
  ['*', '.'],
  ['0', '='],
  ['?', 'Z'],
  ['\\', '\\'],
  ['^', '~'],
]);

// Sorted longest first by the compiler, so `else if` beats `else`.
const BLOCK_KEYWORDS = [
  'if',
  'else if',
  'else',
  'for',
  'repeat',
  'switch',
  'case',
  'default',
  'try',
  'catch',
  'loading',
  'reveal',
  'portal',
  'no-hydration',
  'hydration',
  'key',
  'template',
];

const RAW = TOKENS.raw_svelte_expression;

// Strings and comments in raw code, so their brackets do not count.
const rawSkips = [
  within('"', '"', RAW, { escape: '\\', multiline: true }),
  within("'", "'", RAW, { escape: '\\', multiline: true }),
  within('`', '`', RAW, { escape: '\\', multiline: true }),
  within('/*', '*/', RAW, { multiline: true }),
  within('//', '\n', RAW),
];

// Inside `{…}`, nested braces are tracked until the brace that closes it.
const expressionRules = [
  ...rawSkips,
  match('{', RAW, enter('expression_brace')),
  fallback({ token: RAW }),
];

const tagRules = [
  on(WHITESPACE),
  match('=', TOKENS.operator, enter('attr_value')),
  match('{', TOKENS.expression, enter('expression_body')),
  match('[', RAW, enter('raw_group')),
  match('bind:', TOKENS.svelte_directive),
  match(ATTR_NAME_CHARS, TOKENS.attr_name),
  match(':', TOKENS.attr_name),
];

/** Raw code between `start` and `end` that ends the state, as in `</script>`. */
function rawBlock(name: 'script' | 'style', token: string) {
  return {
    [`${name}_attrs`]: {
      rules: [
        match('>', TOKENS.punctuation, goto(`${name}_content`)),
        on(WHITESPACE),
        match('=', TOKENS.operator),
        within('"', '"', TOKENS.string),
        within("'", "'", TOKENS.string),
        match(ATTR_NAME_CHARS, TOKENS.attr_name),
      ],
    },
    [`${name}_content`]: {
      rules: [on('</', enter(`${name}_close_probe`)), fallback({ token })],
    },
    [`${name}_close_probe`]: {
      mode: 'probe' as const,
      fallback: `${name}_close_fail`,
      rules: [on(`${name}>`, goto(`${name}_close`)), fallback(goto(`${name}_close_fail`))],
    },
    [`${name}_close_fail`]: { rules: [match('<', token, leave())] },
    [`${name}_close`]: {
      rules: [
        match('</', TOKENS.punctuation),
        match(name, TOKENS.tag_name),
        match('>', TOKENS.punctuation, goto('content')),
      ],
    },
  };
}

export const rawGrammar = define_grammar({
  name: 'solid',
  states: {
    content: {
      rules: [
        within('<!--', '-->', TOKENS.comment),
        match('</', TOKENS.punctuation, enter('close_tag')),
        on('<', enter('lt_probe')),
        on('#', enter('hash_probe')),
        match('{', TOKENS.expression, enter('expression_body')),
        // The brace that closes a block body.
        match('}', TOKENS.punctuation),
        fallback({}),
      ],
    },

    // `#` starts a block only before a known keyword, so `#1` stays text.
    hash_probe: {
      mode: 'probe',
      fallback: 'hash_text',
      rules: [
        on(BLOCK_KEYWORDS, { boundary: true, ...enter('block_start') }),
        fallback(enter('hash_text')),
      ],
    },
    hash_text: { rules: [on('#'), fallback(leave())] },
    block_start: {
      rules: [match('#', TOKENS.svelte_block, goto('block_keyword'))],
    },
    block_keyword: {
      rules: [
        keyword(['template'], goto('template_name'), TOKENS.svelte_block),
        match(BLOCK_KEYWORDS, TOKENS.svelte_block, goto('block_header')),
      ],
    },
    // A range matches one character, so the name continues in its own state.
    template_name: {
      rules: [
        on(WHITESPACE),
        match(ATTR_NAME_CHARS, TOKENS.function, goto('template_name_rest')),
        fallback(goto('block_header')),
      ],
    },
    template_name_rest: {
      rules: [match(ATTR_NAME_CHARS, TOKENS.function), fallback(goto('block_header'))],
    },
    // An optional header in parentheses, then the `{` of the body.
    block_header: {
      rules: [
        on(WHITESPACE),
        match('(', TOKENS.punctuation, goto('block_header_body')),
        match('{', TOKENS.punctuation, leave()),
        fallback(leave()),
      ],
    },
    // `by` in `#for (item of list by item.id)` is a keyword of the block.
    // Words are read whole, so `by` only matches on its own.
    block_header_body: {
      rules: [
        ...rawSkips,
        match(['(', '['], RAW, enter('raw_group')),
        match(')', TOKENS.punctuation, goto('block_header')),
        keyword(['by'], {}, TOKENS.keyword),
        match(WORD_CHARS, RAW, enter('raw_word')),
        fallback({ token: RAW }),
      ],
    },
    raw_word: {
      rules: [match(WORD_CHARS, RAW), fallback(leave())],
    },

    // `<` opens a tag before a letter, `>` (a fragment) or `{` (a dynamic tag).
    lt_probe: {
      mode: 'probe',
      fallback: 'lt_text',
      rules: [
        on(ASCII_ALPHA, enter('lt_tag')),
        on(['>', '{'], enter('lt_tag')),
        fallback(enter('lt_text')),
      ],
    },
    lt_tag: { rules: [match('<', TOKENS.punctuation, goto('tag_start'))] },
    lt_text: { rules: [on('<'), fallback(leave())] },

    tag_start: {
      rules: [
        keyword(['script'], goto('script_attrs'), TOKENS.tag_name),
        keyword(['style'], goto('style_attrs'), TOKENS.tag_name),
        match('>', TOKENS.punctuation, leave()),
        match('{', TOKENS.expression, goto('dynamic_tag')),
        match(TAG_NAME_CHARS, TOKENS.tag_name, goto('tag_open')),
      ],
    },
    dynamic_tag: {
      rules: [match('}', TOKENS.expression, goto('tag_attrs')), ...expressionRules],
    },
    tag_open: {
      rules: [
        match('/>', TOKENS.punctuation, leave()),
        match('>', TOKENS.punctuation, leave()),
        on(WHITESPACE, goto('tag_attrs')),
        match(TAG_NAME_CHARS, TOKENS.tag_name),
      ],
    },
    tag_attrs: {
      rules: [
        match('/>', TOKENS.punctuation, leave()),
        match('>', TOKENS.punctuation, leave()),
        ...tagRules,
      ],
    },
    close_tag: {
      rules: [
        match('>', TOKENS.punctuation, leave()),
        on(WHITESPACE),
        match(TAG_NAME_CHARS, TOKENS.tag_name),
      ],
    },

    // The value after `=`: a string, an object in braces, or code without quotes.
    attr_value: {
      rules: [
        within('"', '"', TOKENS.string, { multiline: true }),
        within("'", "'", TOKENS.string, { multiline: true }),
        match('{', TOKENS.expression, goto('expression_body')),
        fallback(goto('bare_value')),
      ],
    },
    bare_value: {
      rules: [
        ...rawSkips,
        match(['(', '['], RAW, enter('raw_group')),
        match(BARE_VALUE_CHARS, RAW),
        fallback(leave()),
      ],
    },
    raw_group: {
      rules: [
        ...rawSkips,
        match(['(', '['], RAW, enter('raw_group')),
        match([')', ']'], RAW, leave()),
        fallback({ token: RAW }),
      ],
    },

    expression_body: {
      rules: [match('}', TOKENS.expression, leave()), ...expressionRules],
    },
    expression_brace: {
      rules: [match('}', RAW, leave()), ...expressionRules],
    },

    ...rawBlock('script', TOKENS.raw_script),
    ...rawBlock('style', TOKENS.raw_style),
  },
});

let tsxLanguage: ReturnType<typeof tsx> | undefined;
let cssLanguage: ReturnType<typeof css> | undefined;
const embedTsx = (input: string) => (tsxLanguage ??= tsx())(input);

export const tokenize = create_language(compile(rawGrammar), [
  always(
    embed_grammars({
      [TOKENS.raw_script]: embedTsx,
      [TOKENS.raw_svelte_expression]: embedTsx,
      [TOKENS.raw_style]: (input: string) => (cssLanguage ??= css())(input),
    }),
    'embed',
  ),
]);

/** Returns a function that highlights `.solid` code as HTML. */
export function language(options?: LanguageOptions) {
  const run = tokenize(options);
  return (input: string, render?: RenderOptions): string => to_html(input, run(input), render);
}
