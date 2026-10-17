/**
 * Lays out the compiled module so it reads like code written by hand: the
 * imports first, a blank line between the parts of the module, the script
 * indented in the component function and the markup indented in its
 * `return`. Only the whitespace at the start of lines and blank lines
 * change, and imports move up, so the code means the same. Lines that start
 * inside a template literal or a string are left alone.
 */
import { MagicString } from 'magic-string';
import type { SourceMap } from 'magic-string';
import { parseSync } from 'oxc-parser';
import type { Node } from './labels/ast.ts';

interface Line {
  start: number;
  /** The offset of the line break, or the end of the code. */
  end: number;
  /** The length of the whitespace at the start. */
  indent: number;
  blank: boolean;
  /** True if the line starts inside a template literal or a string. */
  literal: boolean;
}

/** Spaces that a tab counts as. */
const TAB_WIDTH = 2;
const SCRIPT_INDENT = 2;
const MARKUP_INDENT = 6;

function isNode(value: unknown): value is Node {
  return value != null && typeof value === 'object' && typeof (value as Node).type === 'string';
}

function walk(node: Node, visit: (node: Node) => void): void {
  visit(node);
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) {
          walk(item, visit);
        }
      }
    } else if (isNode(value)) {
      walk(value, visit);
    }
  }
}

function width(text: string): number {
  let total = 0;
  for (const char of text) {
    total += char === '\t' ? TAB_WIDTH : 1;
  }
  return total;
}

function splitLines(code: string, literals: Node[]): Line[] {
  const lines: Line[] = [];
  let start = 0;
  while (start <= code.length) {
    let end = code.indexOf('\n', start);
    if (end === -1) {
      end = code.length;
    }
    let indent = 0;
    while (
      start + indent < end &&
      (code[start + indent] === ' ' || code[start + indent] === '\t')
    ) {
      indent++;
    }
    lines.push({
      start,
      end,
      indent,
      blank: start + indent === end || (start + indent === end - 1 && code[end - 1] === '\r'),
      literal: literals.some((node) => node.start < start && start < node.end),
    });
    start = end + 1;
  }
  return lines;
}

/** Lays out `code`, or returns undefined if it cannot be parsed. */
export function layout(
  code: string,
  filename: string,
): { code: string; map: SourceMap } | undefined {
  const { program, errors } = parseSync(filename, code, { lang: 'tsx', sourceType: 'module' });
  if (errors.length > 0) {
    return undefined;
  }
  const literals: Node[] = [];
  walk(program as unknown as Node, (node) => {
    if (
      node.type === 'TemplateLiteral' ||
      node.type === 'TSTemplateLiteralType' ||
      (node.type === 'Literal' && typeof node.value === 'string')
    ) {
      literals.push(node);
    }
  });
  const lines = splitLines(code, literals);
  const lineOf = (offset: number): number => {
    let low = 0;
    let high = lines.length - 1;
    while (low < high) {
      const middle = (low + high + 1) >> 1;
      if (lines[middle]!.start <= offset) {
        low = middle;
      } else {
        high = middle - 1;
      }
    }
    return low;
  };

  /** The indentation that each line gets. Lines without one keep theirs. */
  const indents = new Map<number, number>();
  /** Parts of the module. Blank lines at their ends go, and a row of them becomes one. */
  const regions: { first: number; last: number }[] = [];
  /** Lines that get a blank line before them. */
  const separated = new Set<number>();
  /** Lines that moved, so they do not separate blank lines. */
  const moved = new Set<number>();

  const indentOf = (index: number): number => {
    const line = lines[index]!;
    return width(code.slice(line.start, line.start + line.indent));
  };
  const shift = (first: number, last: number, delta: number): void => {
    for (let index = first; index <= last; index++) {
      const line = lines[index]!;
      if (!line.blank && !line.literal && !indents.has(index)) {
        indents.set(index, Math.max(0, indentOf(index) + delta));
      }
    }
  };
  /**
   * Shifts the lines of a statement so its first line has `indent`. Lines
   * before it, such as comments, move with it. When the statement ends with
   * a closing bracket on a line of its own, the lines after the first one
   * move so that bracket lines up with the first line. Code that the
   * compiler generates around the source, such as a function that an effect
   * is moved into, gets the indentation of its source otherwise.
   */
  const place = (from: number, node: Node, indent: number): number => {
    const first = lineOf(node.start);
    const last = lineOf(node.end - 1);
    const delta = indent - indentOf(first);
    shift(from, first, delta);
    const closing = code.slice(lines[last]!.start + lines[last]!.indent, node.end);
    if (last > first && /^[)\]}]/.test(closing) && !lines[last]!.literal) {
      shift(first + 1, last, indent - indentOf(last));
    } else {
      shift(first + 1, last, delta);
    }
    return last;
  };

  const s = new MagicString(code);
  const body = program.body as unknown as Node[];

  // Imports after other statements move up to the imports at the start, in
  // the same order, so they run in the same order.
  let leading = 0;
  while (body[leading]?.type === 'ImportDeclaration') {
    leading++;
  }
  const target = leading > 0 ? lines[lineOf(body[leading - 1]!.end)]!.end + 1 : 0;
  for (const node of body.slice(leading)) {
    const first = lineOf(node.start);
    const last = lineOf(node.end);
    const alone =
      node.type === 'ImportDeclaration' &&
      lines[first]!.start + lines[first]!.indent === node.start &&
      code.slice(node.end, lines[last]!.end).trim() === '';
    if (alone && lines[last]!.end < code.length) {
      s.move(lines[first]!.start, lines[last]!.end + 1, target);
      for (let index = first; index <= last; index++) {
        moved.add(index);
      }
    }
  }
  const firstStatement = body.find(
    (node, index) => index >= leading && node.type !== 'ImportDeclaration',
  );
  if (firstStatement && (leading > 0 || moved.size > 0)) {
    separated.add(lineOf(firstStatement.start));
  }

  const component = body.find(
    (node) =>
      node.type === 'ExportDefaultDeclaration' && node.declaration?.type === 'FunctionDeclaration',
  );
  const fn = component?.declaration as Node | undefined;
  regions.push({ first: 0, last: lines.length - 1 });

  // The statements of the module start at the first column, such as the
  // code of `<script module>`.
  let previousTop = -1;
  for (const node of body) {
    const first = lineOf(node.start);
    if (first <= previousTop) {
      // A statement on the line of the one before moves with it.
      previousTop = Math.max(previousTop, lineOf(node.end - 1));
      continue;
    }
    if (node === component) {
      // The component is written at the first column. Comments before it stay.
      previousTop = lineOf(node.end - 1);
      continue;
    }
    if (component && node.start > component.end) {
      separated.add(first);
    }
    previousTop = place(previousTop + 1, node, 0);
  }
  if (component && fn) {
    const open = lineOf(fn.body.start);
    const close = lineOf(fn.body.end - 1);
    if (body.indexOf(component) > 0) {
      separated.add(lineOf(component.start));
    }
    const statements = fn.body.body as Node[];
    const returned = statements.at(-1);
    const argument =
      returned?.type === 'ReturnStatement' && returned.argument?.type === 'ParenthesizedExpression'
        ? returned.argument.expression
        : undefined;
    const fragment = argument?.type === 'JSXFragment' ? (argument as Node) : undefined;
    const end = fragment ? lineOf(returned!.start) : close;

    // Each statement keeps its own indentation relative to its first line.
    let previous = open;
    for (const statement of fragment ? statements.slice(0, -1) : statements) {
      if (lineOf(statement.start) <= previous) {
        previous = Math.max(previous, lineOf(statement.end - 1));
        continue;
      }
      previous = place(previous + 1, statement, SCRIPT_INDENT);
    }
    regions.push({ first: open + 1, last: end - 1 });
    if (fragment && previous > open) {
      separated.add(end);
    }

    if (fragment) {
      const first = lineOf(fragment.start) + 1;
      const last = lineOf(fragment.closingFragment.start) - 1;
      let least = Infinity;
      for (let index = first; index <= last; index++) {
        const line = lines[index]!;
        if (!line.blank && !line.literal) {
          least = Math.min(least, indentOf(index));
        }
      }
      if (least !== Infinity) {
        shift(first, last, MARKUP_INDENT - least);
      }
      regions.push({ first, last });
    }
  }

  for (const [index, indent] of indents) {
    const line = lines[index]!;
    const text = ' '.repeat(indent);
    if (code.slice(line.start, line.start + line.indent) === text) {
      continue;
    }
    if (line.indent > 0) {
      s.update(line.start, line.start + line.indent, text);
    } else {
      s.prependRight(line.start, text);
    }
  }

  // Blank lines at the start and end of a region go, and a row of them
  // becomes one. The innermost region of a line decides.
  const regionOf = (index: number) =>
    regions.findLast((region) => region.first <= index && index <= region.last);
  let previousBlank = true;
  let previousRegion = regionOf(0);
  for (let index = 0; index < lines.length; index++) {
    if (moved.has(index)) {
      continue;
    }
    const line = lines[index]!;
    const region = regionOf(index);
    if (region !== previousRegion) {
      previousBlank = true;
      previousRegion = region;
    }
    if (!line.blank || line.literal) {
      previousBlank = false;
      continue;
    }
    // A blank line that ends its region goes too.
    let next = index + 1;
    while (
      next < lines.length &&
      (moved.has(next) || (lines[next]!.blank && !lines[next]!.literal))
    ) {
      next++;
    }
    const ends = !region || next > region.last || next >= lines.length;
    if (previousBlank || ends || separated.has(next)) {
      if (line.end < code.length) {
        s.remove(line.start, line.end + 1);
      }
      continue;
    }
    if (line.indent > 0) {
      s.remove(line.start, line.start + line.indent);
    }
    previousBlank = true;
  }
  for (const index of separated) {
    s.prependRight(lines[index]!.start, '\n');
  }

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true, source: filename, includeContent: true }),
  };
}
