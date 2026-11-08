/**
 * Removes the comments and the whitespace that CSS does not need. It keeps
 * the rules as they are, so it is safe for any stylesheet, and it runs where
 * PostCSS runs, including browsers.
 */
import { parse } from 'postcss';

/**
 * Collapses whitespace outside strings to one space. It drops the space next
 * to `separators`, after `(` and before `)`, but keeps the one before `(`,
 * as in `and (min-width: 1px)`.
 */
function compact(text: string, separators: string): string {
  let result = '';
  // The last character written. An escape counts as `\`, so `\,` is no separator.
  let last: string | undefined;
  let quote: string | undefined;
  let space = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      result += char;
      last = char;
      if (char === '\\') {
        result += text[++i] ?? '';
      } else if (char === quote) {
        quote = undefined;
      }
      continue;
    }
    if (/\s/.test(char)) {
      space = true;
      continue;
    }
    if (
      space &&
      last !== undefined &&
      last !== '(' &&
      char !== ')' &&
      !separators.includes(char) &&
      !separators.includes(last)
    ) {
      result += ' ';
    }
    space = false;
    last = char;
    if (char === '\\') {
      // An escaped character, such as `\ ` or `\"`, is part of the token.
      // PostCSS trims an escaped space at the end of a value, so it is put back.
      result += char + (text[++i] ?? ' ');
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
    }
    result += char;
  }
  return result;
}

/** Returns `code` without comments and the whitespace that it does not need. */
export function minifyCSS(code: string): string {
  const root = parse(code);
  root.walkComments((comment) => {
    comment.remove();
  });
  root.walk((node) => {
    node.raws.before = '';
    if (node.type === 'decl') {
      node.raws.between = ':';
      node.prop = node.prop.trim();
      node.value = compact(node.value, ',');
      // PostCSS writes the original text of a value that did not change.
      delete node.raws.value;
      if (node.important) {
        node.raws.important = '!important';
      }
      return;
    }
    node.raws.after = '';
    node.raws.semicolon = false;
    if (node.type === 'rule') {
      node.raws.between = '';
      node.selector = compact(node.selector, ',>+~');
      delete node.raws.selector;
    } else if (node.type === 'atrule') {
      node.raws.between = '';
      node.params = compact(node.params, ',:');
      delete node.raws.params;
      node.raws.afterName = node.params ? ' ' : '';
    }
  });
  root.raws.after = '';
  root.raws.semicolon = false;
  return root.toString();
}
