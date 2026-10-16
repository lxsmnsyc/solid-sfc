/**
 * Completions and code actions for the parts of a `.solid` file that
 * TypeScript does not know about: control flow blocks and `solid:` elements.
 */
import { compileForEditor } from './recovery.ts';

export interface Completion {
  label: string;
  /** A snippet, with `$1` style tab stops. */
  snippet: string;
  detail: string;
  /** The text from here to the cursor is replaced. */
  start: number;
}

export interface TextEdit {
  start: number;
  end: number;
  text: string;
}

export interface CodeAction {
  title: string;
  kind: 'refactor.rewrite' | 'refactor.extract';
  edits: TextEdit[];
}

const KEYWORDS: { label: string; detail: string; snippet: string[] }[] = [
  {
    label: '#if',
    detail: 'Render markup when a condition is true',
    snippet: ['#if (${1:condition}) {', '\t$0', '}'],
  },
  {
    label: '#else if',
    detail: 'Another branch of #if',
    snippet: ['#else if (${1:condition}) {', '\t$0', '}'],
  },
  { label: '#else', detail: 'The last branch of a block', snippet: ['#else {', '\t$0', '}'] },
  {
    label: '#for',
    detail: 'Render markup for each item of a list',
    snippet: ['#for (${1:item} of ${2:list}) {', '\t$0', '}'],
  },
  {
    label: '#repeat',
    detail: 'Render markup a number of times',
    snippet: ['#repeat (${1:index} of ${2:count}) {', '\t$0', '}'],
  },
  {
    label: '#switch',
    detail: 'Render the first case whose condition is true',
    snippet: ['#switch {', '\t#case (${1:condition}) {', '\t\t$0', '\t}', '}'],
  },
  {
    label: '#case',
    detail: 'A branch of #switch',
    snippet: ['#case (${1:condition}) {', '\t$0', '}'],
  },
  { label: '#default', detail: 'The last branch of #switch', snippet: ['#default {', '\t$0', '}'] },
  {
    label: '#try',
    detail: 'Render a fallback when the body throws',
    snippet: ['#try {', '\t$1', '} #catch (${2:error}, ${3:reset}) {', '\t$0', '}'],
  },
  {
    label: '#catch',
    detail: 'The fallback of #try',
    snippet: ['#catch (${1:error}, ${2:reset}) {', '\t$0', '}'],
  },
  {
    label: '#loading',
    detail: 'Render a fallback while the body loads',
    snippet: ['#loading {', '\t$1', '} #else {', '\t$0', '}'],
  },
  {
    label: '#reveal',
    detail: 'Control the order in which loading blocks show their content',
    snippet: ["#reveal ('${1|sequential,together,natural|}') {", '\t$0', '}'],
  },
  {
    label: '#portal',
    detail: 'Render markup at the end of the document body',
    snippet: ['#portal {', '\t$0', '}'],
  },
  {
    label: '#key',
    detail: 'Render the body again when a value changes',
    snippet: ['#key (${1:value}) {', '\t$0', '}'],
  },
  {
    label: '#no-hydration',
    detail: 'Render the body on the server only',
    snippet: ['#no-hydration {', '\t$0', '}'],
  },
  {
    label: '#hydration',
    detail: 'Hydrate the body inside #no-hydration',
    snippet: ['#hydration {', '\t$0', '}'],
  },
  {
    label: '#template',
    detail: 'Declare markup that the file can render with arguments',
    snippet: ['#template ${1:name}(${2:params}) {', '\t$0', '}'],
  },
];

const SOLID_ELEMENTS: { label: string; detail: string; snippet: string }[] = [
  {
    label: 'window',
    detail: 'Listen to window events',
    snippet: 'window on${1:KeyDown}=${2:handler} />',
  },
  {
    label: 'document',
    detail: 'Listen to document events',
    snippet: 'document on${1:VisibilityChange}=${2:handler} />',
  },
  {
    label: 'hydration-script',
    detail: 'The script that hydration needs, in the document head',
    snippet: 'hydration-script />',
  },
];

/** The ranges of every `<script>`, `<style>` and comment, which are not markup. */
function nonMarkup(source: string): { start: number; end: number }[] {
  const pattern = /<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)|<!--[\s\S]*?(?:-->|$)/g;
  return [...source.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

function inMarkup(source: string, offset: number): boolean {
  return !nonMarkup(source).some((range) => range.start < offset && offset < range.end);
}

/** Completions for control flow keywords and `solid:` elements at `offset`. */
export function getCompletions(source: string, offset: number): Completion[] {
  if (!inMarkup(source, offset)) {
    return [];
  }
  const line = source.slice(source.lastIndexOf('\n', offset - 1) + 1, offset);
  const keyword = /(?:^|[\s>}])(#[a-z-]*)$/.exec(line);
  if (keyword) {
    const start = offset - keyword[1]!.length;
    return KEYWORDS.map((item) => ({
      label: item.label,
      detail: item.detail,
      snippet: item.snippet.join('\n'),
      start,
    }));
  }
  const element = /<solid:([a-z-]*)$/.exec(line);
  if (element) {
    const start = offset - element[1]!.length;
    return SOLID_ELEMENTS.map((item) => Object.assign({ start }, item));
  }
  return [];
}

/** The indentation of the line that contains `offset`. */
function indentAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))![0];
}

/** The indentation step of the file: a tab, or the smallest run of spaces. */
function indentUnit(source: string): string {
  const sizes = [...source.matchAll(/^( +)\S/gm)].map((match) => match[1]!.length);
  if (sizes.length === 0) {
    return /^\t/m.test(source) ? '\t' : '  ';
  }
  return ' '.repeat(Math.min(...sizes));
}

/** Adds `prefix` to every line of `text` that is not empty. */
function indent(text: string, prefix: string): string {
  return text.replace(/^(?=.*\S)/gm, prefix);
}

/** Removes the common indentation of the lines of `text`. */
function dedent(text: string): string {
  const sizes = [...text.matchAll(/^([ \t]*)\S/gm)].map((match) => match[1]!.length);
  const size = sizes.length > 0 ? Math.min(...sizes) : 0;
  return text.replace(new RegExp(`^[ \\t]{0,${size}}`, 'gm'), '');
}

const WRAPPERS = [
  { title: 'Wrap in #if', open: '#if (condition) {' },
  { title: 'Wrap in #for', open: '#for (item of list) {' },
  { title: 'Wrap in #loading', open: '#loading {' },
  { title: 'Wrap in #try', open: '#try {' },
];

/**
 * Code actions for markup from `start` to `end`: wrap it in a block, or
 * extract it to a `#template`.
 */
export function getCodeActions(source: string, start: number, end: number): CodeAction[] {
  if (start === end || !inMarkup(source, start) || !inMarkup(source, end)) {
    return [];
  }
  // Whole lines are wrapped and extracted.
  const from = source.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = source.indexOf('\n', end - 1 > from ? end - 1 : end);
  const to = lineEnd === -1 ? source.length : lineEnd;
  const selected = source.slice(from, to);
  if (!selected.trim()) {
    return [];
  }
  const base = indentAt(source, from);
  const unit = indentUnit(source);
  const body = indent(dedent(selected), base + unit);

  const actions: CodeAction[] = WRAPPERS.map((wrapper) => ({
    title: wrapper.title,
    kind: 'refactor.rewrite',
    edits: [{ start: from, end: to, text: `${base}${wrapper.open}\n${body}\n${base}}` }],
  }));

  // The template goes at the start of the innermost block around the markup,
  // so it can use the variables of the block. Outside blocks, it goes at the
  // end of the file.
  let name = 'extracted';
  for (let index = 2; new RegExp(`\\b${name}\\b`).test(source); index++) {
    name = `extracted${index}`;
  }
  const bodies = compileForEditor(source).result?.bodies ?? [];
  const block = bodies
    .filter((range) => range.start < from && to <= range.end)
    .toSorted((a, b) => b.start - a.start)[0];
  const call = { start: from, end: to, text: `${base}{${name}()}` };
  if (block) {
    const blockIndent = indentAt(source, block.start) + unit;
    const template = `\n${blockIndent}#template ${name}() {\n${indent(dedent(selected), blockIndent + unit)}\n${blockIndent}}`;
    actions.push({
      title: 'Extract to #template',
      kind: 'refactor.extract',
      edits: [{ start: block.start + 1, end: block.start + 1, text: template }, call],
    });
  } else {
    const ending = source.endsWith('\n') ? '' : '\n';
    const template = `${ending}\n#template ${name}() {\n${indent(dedent(selected), unit)}\n}\n`;
    actions.push({
      title: 'Extract to #template',
      kind: 'refactor.extract',
      edits: [call, { start: source.length, end: source.length, text: template }],
    });
  }
  return actions;
}
