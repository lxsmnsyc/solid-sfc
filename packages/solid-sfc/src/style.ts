import { CssSyntaxError, parse } from 'postcss';
import type { AtRule, Root } from 'postcss';
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

export interface StyleResult {
  code: string;
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
 * element. `:global(...)` is replaced by its content and is not scoped.
 */
function scopeSelector(selector: Selector, attribute: string): ScopedSelector | undefined {
  let lastCompound = 0;
  selector.each((node, index) => {
    if (node.type === 'combinator') {
      lastCompound = index + 1;
    }
  });
  const compound = selector.nodes.slice(lastCompound);
  const skip = compound.some((node) => isGlobal(node) || node.type === 'nesting');

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
  const pseudoElement = compound.find(isPseudoElement);
  if (pseudoElement) {
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
    root = parse(css, { from: filename });
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
      const scoped = scopeSelector(selector, attribute);
      if (scoped) {
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
    map: { inline: false, annotation: false, sourcesContent: false },
  });
  const raw = result.map.toJSON();
  const map: SourceMap = { ...raw, version: Number(raw.version), sourcesContent: [source] };

  return {
    code: result.css,
    map,
    variables,
    scoped: blocks.some((block) => block.attributes.global !== true),
    selectors,
  };
}
