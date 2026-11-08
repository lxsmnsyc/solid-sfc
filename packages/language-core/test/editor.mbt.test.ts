/**
 * Model-based test of the editor path. The model is the text of a `.solid`
 * file. Commands edit it the way a user types, and the real system is the
 * language plugin that Volar updates after every edit.
 */
import type { CodeMapping, VirtualCode } from '@volar/language-core';
import * as fc from 'fast-check';
import { parseSync } from 'oxc-parser';
import { SFCError, compile } from 'solid-sfc';
import { describe, expect, it } from 'vitest';
import {
  compileForEditor,
  createSolidLanguagePlugin,
  createSolidVirtualCode,
  getCodeActions,
  getCompletions,
} from '../src/index.ts';

const FILE_NAME = '/src/App.solid';

/** Env values: `FC_SEED` pins the run, `FC_RUNS` sets the number of sequences. */
const SEED = Number(process.env.FC_SEED ?? 20261108);
const RUNS = Number(process.env.FC_RUNS ?? 150);

const BASES = [
  '<p>hello</p>\n',
  '<script>\n  let count = $signal(0);\n</script>\n\n<button onClick=(() => count++)>{count}</button>\n',
  '<script>\n  const items = [1, 2];\n</script>\n\n<ul>\n  #for (item of items) {\n    <li>{item}</li>\n  }\n</ul>\n',
  '<style>\n  p { color: red; }\n</style>\n\n<p class="a">text</p>\n',
  '<script>\n  let a = $signal(true);\n</script>\n<style>\n  .x { width: ${a ? 1 : 2}px; }\n</style>\n\n#if (a) {\n  <div class="x">yes</div>\n} #else {\n  <span>no</span>\n}\n',
  '<script>\n  const title = "t";\n</script>\n\n<div title=title>\n  #switch {\n    #case (title) {\n      <b>b</b>\n    }\n    #default {\n      <i>i</i>\n    }\n  }\n</div>\n',
  '#template row(name) {\n  <li>{name}</li>\n}\n\n<ul>{row("a")}</ul>\n',
];

/** Pieces that a user types, whole or half way. */
const SNIPPETS = [
  'a',
  ' ',
  '\n',
  '<',
  '>',
  '/',
  '{',
  '}',
  '(',
  ')',
  '"',
  "'",
  '`',
  '#',
  '$',
  '<div',
  '<div>',
  '</div>',
  '<p class=',
  '<script>',
  '</script>',
  '<style>',
  '</style>',
  '<!--',
  '-->',
  '#if (a) {',
  '#if (',
  '#else {',
  '#for (item of list) {',
  '#for (',
  '#switch {',
  '#case (a) {',
  '#try {',
  '} #catch (e, r) {',
  '#template t() {',
  '${',
  '${a}',
  '<solid:',
  '<{tag}>',
  '{...props}',
  'onClick=',
  '$signal(0)',
  '.a { color: red; }',
  '\t',
];

/** Whole lines of markup that a user can finish typing. */
const LINES = [
  '<b>x</b>\n',
  '<hr />\n',
  '{count}\n',
  '<!-- note -->\n',
  '<p class="a">hi</p>\n',
  '#if (a) {\n  <i />\n}\n',
  '#for (item of items) {\n  <li>{item}</li>\n}\n',
  '<div>\n  <span />\n</div>\n',
];

/** Style blocks with a selector that postcss-selector-parser rejects. */
const BAD_SELECTORS = [
  '<style>] {}</style>\n',
  '<style>a) {}</style>\n',
  '<style>.a:: {}</style>\n',
  '<style>.a].b {}</style>\n',
];

interface Model {
  text: string;
  /** The texts before each applied edit, for undo. */
  history: string[];
  /** The file the sequence started from. */
  base: string;
}

interface Real {
  /** Virtual code kept across edits, the way Volar updates it. */
  code: VirtualCode;
  plugin: ReturnType<typeof createSolidLanguagePlugin<string>>;
}

type Command = fc.Command<Model, Real>;

function snapshotOf(text: string): Parameters<typeof createSolidVirtualCode>[1] {
  return {
    getText: (start, end) => text.slice(start, end),
    getLength: () => text.length,
    getChangeRange: () => undefined,
  };
}

function textOf(code: VirtualCode): string {
  return code.snapshot.getText(0, code.snapshot.getLength());
}

function clamp(fraction: number, length: number): number {
  return Math.min(length, Math.floor(fraction * (length + 1)));
}

/** Checks the shape of one mapping against both texts. */
function checkMapping(
  mapping: CodeMapping,
  source: string,
  generated: string,
  label: string,
  copies: boolean,
): void {
  const count = mapping.sourceOffsets.length;
  expect(mapping.generatedOffsets.length, `${label}: offsets`).toBe(count);
  expect(mapping.lengths.length, `${label}: lengths`).toBe(count);
  for (let i = 0; i < count; i++) {
    const sourceStart = mapping.sourceOffsets[i]!;
    const generatedStart = mapping.generatedOffsets[i]!;
    const length = mapping.lengths[i]!;
    const generatedLength = mapping.generatedLengths?.[i] ?? length;
    expect(length, `${label}: length`).toBeGreaterThanOrEqual(0);
    expect(sourceStart, `${label}: source start`).toBeGreaterThanOrEqual(0);
    expect(generatedStart, `${label}: generated start`).toBeGreaterThanOrEqual(0);
    expect(sourceStart + length, `${label}: source end`).toBeLessThanOrEqual(source.length);
    expect(generatedStart + generatedLength, `${label}: generated end`).toBeLessThanOrEqual(
      generated.length,
    );
    // A plain mapping with a full feature set copies text. Replaced text
    // (`structure: false`), generated-text mappings (`generatedLengths`) and
    // styles (interpolations are masked) are not copies.
    const data = mapping.data;
    const isCopy =
      copies &&
      mapping.generatedLengths === undefined &&
      data.verification === true &&
      data.completion === true &&
      data.structure === true;
    // The compiler writes some props itself, such as `each` for the list of
    // `#for`. The mapping points at that prop name, which is a word that the
    // generated code spells as `name=`.
    if (copies && mapping.generatedLengths !== undefined) {
      const word = generated.slice(generatedStart, generatedStart + generatedLength);
      expect(word, `${label}: generated word`).toMatch(/^[A-Za-z][\w-]*$/);
      expect(generated[generatedStart + generatedLength], `${label}: after word`).toBe('=');
      expect(generated[generatedStart - 1] ?? ' ', `${label}: before word`).toMatch(/\s/);
    }
    if (isCopy) {
      expect(generated.slice(generatedStart, generatedStart + length), `${label}: text`).toBe(
        source.slice(sourceStart, sourceStart + length),
      );
    }
  }
}

/** Every check that holds for the virtual code of any text. */
function checkVirtualCode(root: VirtualCode, text: string): void {
  expect(textOf(root)).toBe(text);
  for (const mapping of root.mappings) {
    checkMapping(mapping, text, text, 'root', true);
  }
  const ids = new Set<string>();
  for (const embedded of root.embeddedCodes ?? []) {
    expect(ids.has(embedded.id), `duplicate id ${embedded.id}`).toBe(false);
    ids.add(embedded.id);
    const generated = textOf(embedded);
    for (const mapping of embedded.mappings) {
      checkMapping(mapping, text, generated, embedded.id, embedded.id === 'tsx');
    }
  }
  expect(ids.has('tsx')).toBe(true);
}

/** What the editor shows for a text, as plain data. */
function describeCode(root: VirtualCode): unknown {
  return (root.embeddedCodes ?? []).map((embedded) => ({
    id: embedded.id,
    text: textOf(embedded),
    mappings: embedded.mappings.map((mapping) => ({
      s: mapping.sourceOffsets,
      g: mapping.generatedOffsets,
      l: mapping.lengths,
      gl: mapping.generatedLengths,
      structure: (mapping.data as { structure?: unknown }).structure,
    })),
  }));
}

/** Counters of one run, to see that the checks and the skip path are reached. */
const stats = { states: 0, valid: 0, edits: 0, skipped: 0 };

function isValid(text: string): boolean {
  try {
    compile(text, { filename: FILE_NAME });
    return true;
  } catch {
    return false;
  }
}

function checkText(real: Real, text: string): void {
  // `compileForEditor` never throws, whatever the text.
  const compiled = compileForEditor(text, FILE_NAME);
  checkVirtualCode(real.code, text);

  // Oracle: the code that survived the edits is the code of a fresh start.
  const fresh = createSolidVirtualCode(FILE_NAME, snapshotOf(text));
  expect(describeCode(real.code)).toEqual(describeCode(fresh));

  // Oracle: the diagnostics of the text, compiled twice, are the same.
  const again = compileForEditor(text, FILE_NAME);
  expect(again.error?.message).toBe(compiled.error?.message);
  expect(again.result?.warnings.length).toBe(compiled.result?.warnings.length);

  // `compileStructure` leaves the markup expressions to TypeScript, so only a
  // text that `compile` accepts is valid.
  stats.states++;
  if (isValid(text)) {
    stats.valid++;
    // A valid text has no error and a result, and its TSX has no syntax error.
    expect(compiled.error?.message).toBeUndefined();
    expect(compiled.result).toBeDefined();
    const tsx = real.code.embeddedCodes?.find((item) => item.id === 'tsx');
    const { errors } = parseSync('App.tsx', textOf(tsx!), { lang: 'tsx', sourceType: 'module' });
    expect(errors.map((item) => item.message)).toEqual([]);
  }
}

/**
 * A selector that postcss-selector-parser rejects escapes as a raw `Error`.
 * That is a known finding (see the `it.fails` test), so the sequences skip the
 * edits that cause it. Any other raw error fails the property.
 */
function hitsRawSelectorError(text: string): boolean {
  try {
    compileForEditor(text, FILE_NAME);
    return false;
  } catch (error) {
    if (
      error instanceof Error &&
      !(error instanceof SFCError) &&
      error.stack?.includes('postcss-selector-parser')
    ) {
      return true;
    }
    throw error;
  }
}

/** Returns false when the edit was skipped. */
function applyEdit(model: Model, real: Real, start: number, end: number, insert: string): boolean {
  const next = model.text.slice(0, start) + insert + model.text.slice(end);
  stats.edits++;
  if (hitsRawSelectorError(next)) {
    stats.skipped++;
    return false;
  }
  model.history.push(model.text);
  model.text = next;
  real.code = real.plugin.updateVirtualCode!(
    FILE_NAME,
    real.code,
    snapshotOf(model.text),
    undefined as never,
  ) as VirtualCode;
  checkText(real, model.text);
  return true;
}

/** Completions at `cursor` start at or before it. */
function checkCompletions(text: string, cursor: number): void {
  for (const item of getCompletions(text, cursor)) {
    expect(item.start, `${item.label} start`).toBeLessThanOrEqual(cursor);
    expect(item.start, `${item.label} start`).toBeGreaterThanOrEqual(0);
  }
}

/** Code actions for the lines from `start` to `end` stay inside the text. */
function checkCodeActions(text: string, start: number, end: number): void {
  for (const action of getCodeActions(text, start, end)) {
    for (const edit of action.edits) {
      expect(edit.start, `${action.title} edit`).toBeGreaterThanOrEqual(0);
      expect(edit.start, `${action.title} edit`).toBeLessThanOrEqual(edit.end);
      expect(edit.end, `${action.title} edit`).toBeLessThanOrEqual(text.length);
    }
  }
}

class Insert implements Command {
  constructor(
    readonly where: number,
    readonly piece: string,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    const at = clamp(this.where, model.text.length);
    if (applyEdit(model, real, at, at, this.piece)) {
      checkCompletions(model.text, at + this.piece.length);
    }
  }
  toString(): string {
    return `Insert(${this.where.toFixed(3)}, ${JSON.stringify(this.piece)})`;
  }
}

class Delete implements Command {
  constructor(
    readonly where: number,
    readonly length: number,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    const at = clamp(this.where, model.text.length);
    applyEdit(model, real, at, Math.min(model.text.length, at + this.length), '');
  }
  toString(): string {
    return `Delete(${this.where.toFixed(3)}, ${this.length})`;
  }
}

/** Types a word one character at a time, checking after each character. */
class Type implements Command {
  constructor(
    readonly where: number,
    readonly word: string,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    let at = clamp(this.where, model.text.length);
    for (const char of this.word) {
      if (!applyEdit(model, real, at, at, char)) {
        // The edit was skipped, so the cursor stays.
        continue;
      }
      at += char.length;
      // The editor asks for completions after each typed character.
      checkCompletions(model.text, at);
    }
  }
  toString(): string {
    return `Type(${this.where.toFixed(3)}, ${JSON.stringify(this.word)})`;
  }
}

/** Types a whole line at the start of a line, so the text is often valid again. */
class TypeLine implements Command {
  constructor(
    readonly where: number,
    readonly line: string,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    const cursor = clamp(this.where, model.text.length);
    let at = model.text.lastIndexOf('\n', cursor - 1) + 1;
    // A word at a time, so that the line is whole after a few steps.
    for (const chunk of this.line.split(/(?<=[ \n])/)) {
      if (applyEdit(model, real, at, at, chunk)) {
        at += chunk.length;
        checkCompletions(model.text, at);
      }
    }
  }
  toString(): string {
    return `TypeLine(${this.where.toFixed(3)}, ${JSON.stringify(this.line)})`;
  }
}

/** Goes back a number of edits, like undo in the editor. */
class Undo implements Command {
  constructor(readonly steps: number) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    // The last step goes back to the start of the sequence.
    const target =
      this.steps >= 6 ? model.base : model.history[Math.max(0, model.history.length - this.steps)];
    if (target !== undefined) {
      applyEdit(model, real, 0, model.text.length, target);
    }
  }
  toString(): string {
    return `Undo(${this.steps})`;
  }
}

/** Adds a style block whose selector is half typed, on a line of its own. */
class BadSelector implements Command {
  constructor(
    readonly where: number,
    readonly block: string,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model, real: Real): void {
    const cursor = clamp(this.where, model.text.length);
    const at = model.text.lastIndexOf('\n', cursor - 1) + 1;
    applyEdit(model, real, at, at, this.block);
  }
  toString(): string {
    return `BadSelector(${this.where.toFixed(3)}, ${JSON.stringify(this.block)})`;
  }
}

/** Asks for completions and code actions at a place in the text. */
class Ask implements Command {
  constructor(
    readonly where: number,
    readonly length: number,
  ) {}
  check(): boolean {
    return true;
  }
  run(model: Model): void {
    const text = model.text;
    const cursor = clamp(this.where, text.length);
    checkCompletions(text, cursor);
    // The selection covers whole lines, like a user who selects markup.
    const start = text.lastIndexOf('\n', cursor - 1) + 1;
    let end = start;
    for (let line = 0; line <= this.length % 4; line++) {
      const next = text.indexOf('\n', end);
      end = next === -1 ? text.length : next + (line === this.length % 4 ? 0 : 1);
      if (next === -1) {
        break;
      }
    }
    checkCodeActions(text, start, end);
    checkCodeActions(text, cursor, Math.min(text.length, cursor + this.length));
  }
  toString(): string {
    return `Ask(${this.where.toFixed(3)}, ${this.length})`;
  }
}

const fraction = fc.double({ min: 0, max: 1, noNaN: true });
const piece = fc.oneof(
  { weight: 4, arbitrary: fc.constantFrom(...SNIPPETS) },
  { weight: 1, arbitrary: fc.string({ maxLength: 4 }) },
);

const commands = fc.commands(
  [
    fc.tuple(fraction, piece).map(([where, text]) => new Insert(where, text)),
    fc.tuple(fraction, fc.integer({ min: 1, max: 12 })).map(([where, n]) => new Delete(where, n)),
    fc
      .tuple(fraction, fc.constantFrom('#if', '<div>', '<solid:', '#for (', '{a}', '<p></p>'))
      .map(([where, word]) => new Type(where, word)),
    fc.tuple(fraction, fc.integer({ min: 0, max: 40 })).map(([where, n]) => new Ask(where, n)),
    fc.tuple(fraction, fc.constantFrom(...LINES)).map(([where, line]) => new TypeLine(where, line)),
    fc.integer({ min: 1, max: 6 }).map((steps) => new Undo(steps)),
    fc.constant(new Undo(6)),
    fc.constant(new Undo(6)),
    fc.tuple(fraction, fc.constantFrom(...LINES)).map(([where, line]) => new TypeLine(where, line)),
    fc
      .tuple(fraction, fc.constantFrom(...BAD_SELECTORS))
      .map(([where, block]) => new BadSelector(where, block)),
  ],
  { size: 'small', maxCommands: 25 },
);

/** Runs a command sequence from `base`. */
function runSequence(base: string, list: Iterable<Command>): void {
  const plugin = createSolidLanguagePlugin<string>();
  const real: Real = {
    plugin,
    code: createSolidVirtualCode(FILE_NAME, snapshotOf(base)),
  };
  const model: Model = { text: base, history: [], base };
  checkText(real, base);
  fc.modelRun(() => ({ model, real }), list);
}

function property(): fc.IPropertyWithHooks<[string, Iterable<Command>]> {
  return fc.property(fc.constantFrom(...BASES), commands, runSequence);
}

function assertProperty(): void {
  Object.assign(stats, { states: 0, valid: 0, edits: 0, skipped: 0 });
  try {
    fc.assert(property(), { seed: SEED, numRuns: RUNS, endOnFailure: false });
  } catch (error) {
    // The message has the seed and the shrunk command sequence.
    throw new Error(`FC_SEED=${SEED} FC_RUNS=${RUNS}\n${String(error)}`, { cause: error });
  }
}

describe('editor model', () => {
  it('keeps the virtual code consistent through random edits', () => {
    expect(() => assertProperty()).not.toThrow();
    if (process.env.FC_STATS) {
      process.stderr.write(`${JSON.stringify(stats)}\n`);
    }
    // The checks must run on valid texts, and the skip path must be reached
    // while the selector finding is open.
    const few = RUNS < 100;
    const share = stats.valid / stats.states;
    expect(few || share > 0.3, `share of valid states ${share}`).toBe(true);
    let open = false;
    try {
      compileForEditor('<style>] {}</style><p />', FILE_NAME);
    } catch {
      open = true;
    }
    expect(few || !open || stats.skipped > 0, 'skip path reached').toBe(true);
  });
});

describe('findings', () => {
  // Shrunk by the model: base `<style>\n  p { color: red; }\n</style>\n\n<p class="a">text</p>\n`,
  // then Insert(0, "/") and Insert(0, "<style>"). The style block is `/<style>\n  p`.
  // postcss-selector-parser throws a plain `Error`, which `compileForEditor` rethrows.
  it.fails('compileForEditor does not throw on an unbalanced selector', () => {
    expect(() => compileForEditor('<style>] {}</style><p />', FILE_NAME)).not.toThrow();
    expect(() =>
      compileForEditor('<style>/<style>\n  p { color: red; }\n</style>\n', FILE_NAME),
    ).not.toThrow();
  });

  it.fails('the language plugin does not throw while a style selector is half typed', () => {
    const plugin = createSolidLanguagePlugin<string>();
    const text = '<style>/<style>\n  p { color: red; }\n</style>\n';
    expect(() =>
      plugin.createVirtualCode!(FILE_NAME, 'solid', snapshotOf(text), undefined as never),
    ).not.toThrow();
  });
});
