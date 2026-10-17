import { CssSyntaxError, parse } from 'postcss';
import type { AtRule, Root, Syntax } from 'postcss';
import less from 'postcss-less';
import scss from 'postcss-scss';
import selectorParser from 'postcss-selector-parser';
import type { Node as SelectorNode, Selector } from 'postcss-selector-parser';
import { Scanner } from './scanner.ts';
import type { Block, Range } from './template.ts';

export interface SourceMap {
  version: number;
  file?: string;
  sources: string[];
  sourcesContent?: (string | null)[];
  names: string[];
  mappings: string;
}

export interface StyleVariable extends Range {
  /** Text of the same CSS token before the interpolation, such as `#`. */
  prefix: string;
  /** Text of the same CSS token after the interpolation, such as `px`. */
  suffix: string;
}

// Characters that join an interpolation with the CSS token around it.
const TOKEN_CHARACTER = /[\w%#.-]/;

/** The scoped part of a selector, used to find selectors that match nothing. */
export interface ScopedSelector {
  /** The text of the scoped part, such as `p.item`. */
  text: string;
  offset: number;
  tag: string | undefined;
  classes: string[];
  ids: string[];
}

/** The languages that `<style lang>` accepts. Vite compiles SCSS and Less. */
export type StyleLang = 'css' | 'scss' | 'less';

const SYNTAXES: Record<StyleLang, Syntax | undefined> = {
  css: undefined,
  scss,
  less: less as Syntax,
};

// Selectors that a preprocessor builds or that are not elements, such as
// `.btn-#{$name}`, `%placeholder` and Less mixins, are not checked for use.
const PREPROCESSED_SELECTOR = /#\{|@\{|%/;
const LESS_MIXIN = /^[.#][\w-]+\s*\(.*\)\s*(?:when\b.*)?$/s;

export interface StyleResult {
  code: string;
  /** The language of the stylesheet. Vite compiles it when it is not CSS. */
  lang: StyleLang;
  map: SourceMap;
  /** Each `${...}` expression, in order. */
  variables: StyleVariable[];
  /** True if at least one block is scoped. */
  scoped: boolean;
  selectors: ScopedSelector[];
}

const KEYFRAMES = /^(-\w+-)?keyframes$/i;
const ANIMATION = /^(-\w+-)?animation(-name)?$/i;
const LEGACY_PSEUDO_ELEMENTS = new Set([':before', ':after', ':first-line', ':first-letter']);

/** A short, stable hash of a string (FNV-1a, base 36). */
export function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    result ^= value.charCodeAt(i);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

export function getScopeAttribute(scope: string): string {
  return `s-${scope}`;
}

export function getVariableName(scope: string, index: number): string {
  return `--s-${scope}-${index}`;
}

function isPseudoElement(node: SelectorNode): boolean {
  return (
    node.type === 'pseudo' &&
    (node.value.startsWith('::') || LEGACY_PSEUDO_ELEMENTS.has(node.value.toLowerCase()))
  );
}

function isGlobal(node: SelectorNode): node is selectorParser.Pseudo {
  return node.type === 'pseudo' && node.value === ':global';
}

/**
 * Adds the scope attribute to the last compound selector, before any pseudo
 * element. `:global(...)` is replaced by its content and is not scoped. When
 * the last compound is global, as in `.list :global(li)`, the compound
 * before it gets the attribute, so the rule only reaches into this file's
 * elements.
 *
 * With `atStart`, the attribute goes at the start of the compound, after a
 * type selector. SCSS and Less join `&__title` to the parent selector, which
 * then becomes `[s-x].card__title` instead of `.card[s-x]__title`.
 */
function scopeSelector(
  selector: Selector,
  attribute: string,
  atStart: boolean,
): ScopedSelector | undefined {
  const compounds: Selector['nodes'][number][][] = [[]];
  for (const node of selector.nodes) {
    if (node.type === 'combinator') {
      compounds.push([]);
    } else {
      compounds.at(-1)!.push(node);
    }
  }
  // Global compounds at the end are skipped.
  let index = compounds.length - 1;
  while (index > 0 && compounds[index]!.some(isGlobal)) {
    index--;
  }
  const compound = compounds[index]!;
  // A placeholder such as `%shared` is scoped through the selectors that extend it.
  const skip = compound.some(
    (node) =>
      isGlobal(node) ||
      node.type === 'nesting' ||
      (atStart && node.type === 'tag' && node.value.startsWith('%')),
  );

  selector.walkPseudos((node) => {
    if (isGlobal(node)) {
      const inner = node.nodes[0];
      if (inner) {
        node.replaceWith(...inner.nodes);
      } else {
        node.remove();
      }
    }
  });

  if (skip || compound.length === 0) {
    return undefined;
  }
  const scoped: ScopedSelector = {
    text: compound.map(String).join('').trim(),
    offset: compound[0]!.sourceIndex,
    tag: undefined,
    classes: [],
    ids: [],
  };
  for (const node of compound) {
    if (node.type === 'tag') {
      scoped.tag = node.value.toLowerCase();
    } else if (node.type === 'class') {
      scoped.classes.push(node.value);
    } else if (node.type === 'id') {
      scoped.ids.push(node.value);
    }
  }
  const scope = selectorParser.attribute({
    attribute,
    value: undefined,
    raws: {},
    quoteMark: null,
  });
  const first = compound[0]!;
  const pseudoElement = compound.find(isPseudoElement);
  if (atStart && (first.type === 'tag' || first.type === 'universal')) {
    selector.insertAfter(first, scope);
  } else if (atStart) {
    selector.insertBefore(first, scope);
  } else if (pseudoElement) {
    selector.insertBefore(pseudoElement, scope);
  } else {
    selector.insertAfter(compound[compound.length - 1]!, scope);
  }
  return scoped;
}

function renameAnimations(value: string, names: Map<string, string>): string {
  return value.replace(/[A-Za-z_-][\w-]*/g, (word) => names.get(word) ?? word);
}

export interface ProcessStylesOptions {
  source: string;
  blocks: Block[];
  scope: string;
  filename: string | undefined;
  fail: (message: string, offset: number) => never;
}

/**
 * Turns the `<style>` blocks of a file into one stylesheet. Selectors and
 * keyframes in scoped blocks get the scope of the component. Each `${...}`
 * becomes a CSS variable that the component sets on its elements.
 */
export function processStyles(options: ProcessStylesOptions): StyleResult {
  const { source, blocks, scope, filename, fail } = options;
  const langs = new Set(blocks.map((block) => block.attributes.lang ?? 'css'));
  if (langs.size > 1) {
    fail('All <style> blocks of a file must have the same lang', blocks[1]!.start);
  }
  const lang = [...langs][0];
  if (lang !== 'css' && lang !== 'scss' && lang !== 'less') {
    return fail(
      `Unsupported style lang "${String(lang)}". Use css, scss or less`,
      blocks[0]!.start,
    );
  }
  const syntax = SYNTAXES[lang];
  const scanner = new Scanner(source, {
    error: fail,
    element: (offset) => fail('Unexpected element in a style interpolation', offset),
  });

  // The CSS keeps the offsets of the file, so the source map points to the
  // right lines. Everything outside the style blocks becomes whitespace.
  let css = '';
  let previous = 0;
  const padding = (end: number): string => source.slice(previous, end).replace(/[^\n]/g, ' ');
  const variables: StyleVariable[] = [];
  const placeholders: string[] = [];

  for (const block of blocks) {
    css += padding(block.contentStart);
    previous = block.contentStart;
    let i = block.contentStart;
    while (i < block.contentEnd) {
      if (source.startsWith('/*', i)) {
        // Comments can mention `${...}` without making a variable.
        const end = source.indexOf('*/', i + 2);
        i = end === -1 || end + 2 > block.contentEnd ? block.contentEnd : end + 2;
      } else if (syntax && source.startsWith('//', i) && source[i - 1] !== ':') {
        // SCSS and Less have line comments. `url(http://...)` is not one.
        const end = source.indexOf('\n', i);
        i = end === -1 || end > block.contentEnd ? block.contentEnd : end;
      } else if (source[i] === '$' && source[i + 1] === '{') {
        if (block.attributes.global === true) {
          fail('A global style cannot have interpolations', i);
        }
        const close = scanner.scanExpression(i + 2, '}');
        if (!source.slice(i + 2, close).trim()) {
          fail('Empty interpolation', i);
        }
        // `var()` cannot be joined with other text, so `${size}px` would
        // become `var(--a)px`. The rest of the token moves into the value.
        let tokenStart = i;
        while (tokenStart > previous && TOKEN_CHARACTER.test(source[tokenStart - 1]!)) {
          tokenStart--;
        }
        let tokenEnd = close + 1;
        while (
          tokenEnd < block.contentEnd &&
          TOKEN_CHARACTER.test(source[tokenEnd]!) &&
          !source.startsWith('${', tokenEnd)
        ) {
          tokenEnd++;
        }
        // A placeholder with the same length keeps the offsets.
        const placeholder = `$${variables.length}$`.padEnd(tokenEnd - tokenStart, '_');
        css += source.slice(previous, tokenStart) + placeholder;
        variables.push({
          start: i + 2,
          end: close,
          prefix: source.slice(tokenStart, i),
          suffix: source.slice(close + 1, tokenEnd),
        });
        placeholders.push(placeholder);
        i = tokenEnd;
        previous = i;
      } else {
        i++;
      }
    }
    css += source.slice(previous, block.contentEnd);
    previous = block.contentEnd;
  }

  let root: Root;
  try {
    root = (syntax?.parse ?? parse)(css, { from: filename }) as Root;
  } catch (error) {
    if (error instanceof CssSyntaxError) {
      const lines = css.split('\n').slice(0, (error.line ?? 1) - 1);
      const offset = lines.reduce((total, line) => total + line.length + 1, 0);
      fail(error.reason, offset + (error.column ?? 1) - 1);
    }
    throw error;
  }

  const isScoped = (offset: number | undefined): boolean => {
    const block = blocks.find(
      (item) => offset !== undefined && offset >= item.contentStart && offset < item.contentEnd,
    );
    return block !== undefined && block.attributes.global !== true;
  };

  const attribute = getScopeAttribute(scope);
  const animations = new Map<string, string>();
  const selectors: ScopedSelector[] = [];
  let ruleOffset = 0;
  const transformSelector = selectorParser((nodes) => {
    nodes.each((selector) => {
      const scoped = scopeSelector(selector, attribute, syntax !== undefined);
      if (scoped && !PREPROCESSED_SELECTOR.test(scoped.text)) {
        selectors.push({ ...scoped, offset: ruleOffset + scoped.offset });
      }
    });
  });

  root.walkAtRules(KEYFRAMES, (rule) => {
    if (isScoped(rule.source?.start?.offset)) {
      const name = rule.params.trim();
      const scoped = `${name}-${scope}`;
      animations.set(name, scoped);
      rule.params = scoped;
    }
  });

  root.walkRules((rule) => {
    if (!isScoped(rule.source?.start?.offset)) {
      return;
    }
    const parent = rule.parent;
    if (parent?.type === 'atrule' && KEYFRAMES.test((parent as AtRule).name)) {
      return;
    }
    // A Less mixin is not a selector of the markup.
    if (lang === 'less' && LESS_MIXIN.test(rule.selector)) {
      return;
    }
    ruleOffset = rule.source?.start?.offset ?? 0;
    rule.selector = transformSelector.processSync(rule.selector);
  });

  if (animations.size > 0) {
    root.walkDecls(ANIMATION, (declaration) => {
      if (isScoped(declaration.source?.start?.offset)) {
        declaration.value = renameAnimations(declaration.value, animations);
      }
    });
  }

  const hasPlaceholder = (value: string): boolean =>
    placeholders.some((placeholder) => value.includes(placeholder));
  root.walk((node) => {
    const text =
      node.type === 'rule'
        ? node.selector
        : node.type === 'atrule'
          ? node.params
          : node.type === 'decl'
            ? node.prop
            : '';
    if (hasPlaceholder(text)) {
      fail(
        'Interpolations are only allowed in declaration values',
        node.source?.start?.offset ?? 0,
      );
    }
  });

  root.walkDecls((declaration) => {
    if (hasPlaceholder(declaration.value)) {
      let { value } = declaration;
      placeholders.forEach((placeholder, index) => {
        value = value.replaceAll(placeholder, `var(${getVariableName(scope, index)})`);
      });
      declaration.value = value;
    }
  });

  // Drop the padding around the blocks.
  root.each((node, index) => {
    node.raws.before = index === 0 ? '' : '\n\n';
  });
  root.raws.after = '\n';

  const result = root.toResult({
    to: filename,
    syntax,
    map: { inline: false, annotation: false, sourcesContent: false },
  });
  // PostCSS makes no source maps in browsers, where the playground runs.
  const raw = (result.map as typeof result.map | undefined)?.toJSON();
  const map: SourceMap = raw
    ? { ...raw, version: Number(raw.version), sourcesContent: [source] }
    : { version: 3, sources: [filename ?? ''], names: [], mappings: '', sourcesContent: [source] };

  return {
    code: result.css,
    map,
    variables,
    scoped: blocks.some((block) => block.attributes.global !== true),
    selectors,
    lang,
  };
}
