import { TraceMap, eachMapping } from '@jridgewell/trace-mapping';
import * as fc from 'fast-check';
import { MagicString } from 'magic-string';
import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import { SFCError, getLocation } from '../src/error.ts';
import { Scanner } from '../src/scanner.ts';
import { TemplateParser } from '../src/template.ts';
import {
  brokenBlock,
  expression,
  listExpression,
  nearValid,
  solidFile,
} from './arbitraries/solid.ts';

// The seed is pinned so a failure replays. fast-check prints it, with the
// shrunk counterexample, when a property fails.
const SEED = Number(process.env.PBT_SEED ?? 20261108);
const RUNS = Number(process.env.PBT_RUNS ?? 300);

/** Runs the property with the pinned seed and reports the seed and the shrunk case on failure. */
function report<T>(property: fc.IProperty<T>): string {
  const result = fc.check(property, { seed: SEED, numRuns: RUNS });
  return result.failed ? (fc.defaultReportMessage(result) ?? 'failed') : '';
}

type Outcome =
  | { ok: true; code: string; map: ReturnType<typeof compile>['map'] }
  | { ok: false; error: unknown };

// The properties of one corpus share the same seed, so they see the same
// sources. Compiling each source once keeps the suite fast.
const outcomes = new Map<string, Outcome>();

function attempt(source: string): Outcome {
  const known = outcomes.get(source);
  if (known) {
    return known;
  }
  let outcome: Outcome;
  try {
    const { code, map } = compile(source, { filename: 'Test.solid' });
    outcome = { ok: true, code, map };
  } catch (error) {
    outcome = { ok: false, error };
  }
  outcomes.set(source, outcome);
  return outcome;
}

function parses(code: string): string[] {
  const { errors } = parseSync('out.tsx', code, { sourceType: 'module', lang: 'tsx' });
  const messages: string[] = [];
  for (const error of errors) {
    messages.push(error.message);
  }
  return messages;
}

/** Why the error is not the compiler's own, or an empty string. */
function checkError(error: unknown, source: string): string {
  if (!(error instanceof SFCError)) {
    return `not an SFCError: ${String(error)}`;
  }
  if (!Number.isInteger(error.offset) || error.offset < 0 || error.offset > source.length) {
    return `offset ${error.offset} is outside the source of length ${source.length}`;
  }
  const { line, column } = getLocation(source, error.offset);
  if (error.line !== line || error.column !== column) {
    return `location ${error.line}:${error.column} does not match offset ${error.offset}`;
  }
  return '';
}

function lineLengths(text: string): number[] {
  const lengths: number[] = [];
  for (const line of text.split('\n')) {
    lengths.push(line.length);
  }
  return lengths;
}

/** Why a mapping lies outside the source or the output, or an empty string. */
function checkMap(source: string, code: string, map: Outcome & { ok: true }): string {
  const original = lineLengths(source);
  const generated = lineLengths(code);
  let problem = '';
  eachMapping(new TraceMap(map.map as never), (mapping) => {
    if (problem) {
      return;
    }
    if (mapping.generatedLine < 1 || mapping.generatedLine > generated.length) {
      problem = `generated line ${mapping.generatedLine} of ${generated.length}`;
    } else if (mapping.generatedColumn > generated[mapping.generatedLine - 1]!) {
      problem = `generated column ${mapping.generatedLine}:${mapping.generatedColumn}`;
    } else if (mapping.originalLine !== null) {
      if (mapping.originalLine < 1 || mapping.originalLine > original.length) {
        problem = `original line ${mapping.originalLine} of ${original.length}`;
      } else if (mapping.originalColumn! > original[mapping.originalLine - 1]!) {
        problem = `original column ${mapping.originalLine}:${mapping.originalColumn}`;
      }
    }
  });
  return problem;
}

describe('compile on generated files', () => {
  it('returns, or throws an SFCError with a location in the source', () => {
    expect(
      report(
        fc.property(solidFile, (source) => {
          const result = attempt(source);
          return result.ok || checkError(result.error, source) === '';
        }),
      ),
    ).toBe('');
  });

  it('returns output that parses', () => {
    expect(
      report(
        fc.property(solidFile, (source) => {
          const result = attempt(source);
          return !result.ok || parses(result.code).length === 0;
        }),
      ),
    ).toBe('');
  });

  it('maps positions inside the source and the output', () => {
    expect(
      report(
        fc.property(solidFile, (source) => {
          const result = attempt(source);
          return !result.ok || checkMap(source, result.code, result) === '';
        }),
      ),
    ).toBe('');
  });

  it('compiles the same source to the same output', () => {
    expect(
      report(
        fc.property(solidFile, (source) => {
          const first = attempt(source);
          const second = attempt(source);
          if (!first.ok || !second.ok) {
            return first.ok === second.ok;
          }
          return first.code === second.code;
        }),
      ),
    ).toBe('');
  });

  it('accepts every file the grammar generates', () => {
    // If the grammar drifts from the docs, the properties above test nothing.
    expect(report(fc.property(solidFile, (source) => attempt(source).ok))).toBe('');
  });
});

describe('compile on almost valid files', () => {
  it('returns, or throws an SFCError with a location in the source', () => {
    expect(
      report(
        fc.property(nearValid, (source) => {
          const result = attempt(source);
          return result.ok || checkError(result.error, source) === '';
        }),
      ),
    ).toBe('');
  });

  it('returns output that parses', () => {
    expect(
      report(
        fc.property(nearValid, (source) => {
          const result = attempt(source);
          return !result.ok || parses(result.code).length === 0;
        }),
      ),
    ).toBe('');
  });

  it('maps positions inside the source and the output', () => {
    expect(
      report(
        fc.property(nearValid, (source) => {
          const result = attempt(source);
          return !result.ok || checkMap(source, result.code, result) === '';
        }),
      ),
    ).toBe('');
  });
});

describe('compile on one broken block', () => {
  it('returns, or throws an SFCError with a location in the source', () => {
    expect(
      report(
        fc.property(brokenBlock, (source) => {
          const result = attempt(source);
          return result.ok || checkError(result.error, source) === '';
        }),
      ),
    ).toBe('');
  });
});

function scan(source: string): ReturnType<TemplateParser['parse']> {
  const fail = (message: string, offset: number): never => {
    throw new SFCError(message, source, offset);
  };
  return new TemplateParser(source, new MagicString(source), fail).parse();
}

describe('block scanner', () => {
  it('splits the file into blocks and markup that join to the input', () => {
    expect(
      report(
        fc.property(fc.oneof(solidFile, nearValid), (source) => {
          let result: ReturnType<typeof scan>;
          try {
            result = scan(source);
          } catch {
            return true;
          }
          const pieces: { start: number; end: number }[] = [...result.blocks, ...result.markup];
          pieces.sort((a, b) => a.start - b.start);
          let joined = '';
          let position = 0;
          for (const piece of pieces) {
            if (piece.start < position) {
              return false;
            }
            // Top-level templates sit inside the markup ranges, not between them.
            joined += source.slice(position, piece.start) + source.slice(piece.start, piece.end);
            position = piece.end;
          }
          joined += source.slice(position);
          return joined === source;
        }),
      ),
    ).toBe('');
  });

  it('keeps block bounds ordered and inside the source', () => {
    expect(
      report(
        fc.property(fc.oneof(solidFile, nearValid), (source) => {
          let result: ReturnType<typeof scan>;
          try {
            result = scan(source);
          } catch {
            return true;
          }
          let previous = 0;
          for (const block of result.blocks) {
            const ordered =
              previous <= block.start &&
              block.start < block.contentStart &&
              block.contentStart <= block.contentEnd &&
              block.contentEnd < block.end &&
              block.end <= source.length;
            if (!ordered || !source.startsWith(`<${block.type}`, block.start)) {
              return false;
            }
            if (!source.slice(block.contentEnd, block.end).startsWith(`</${block.type}`)) {
              return false;
            }
            previous = block.end;
          }
          return true;
        }),
      ),
    ).toBe('');
  });

  it('finds the end of an expression, whatever it holds', () => {
    expect(
      report(
        fc.property(expression, (text) => {
          const source = `${text})tail`;
          const scanner = new Scanner(source, {
            error(message, offset): never {
              throw new SFCError(message, source, offset);
            },
            // The only element in the grammar of expressions is `<li>…</li>`.
            element: (offset) => source.indexOf('</li>', offset) + '</li>'.length,
          });
          return scanner.scanExpression(0, ')') === text.length;
        }),
      ),
    ).toBe('');
  });
});

// Each finding below is a bug in `src/`. Its property fails today, so it is
// marked `it.fails`. When the bug is fixed, vitest reports the test as
// failing because it passes: change `it.fails` to `it`.
describe('findings', () => {
  // Finding 1. `#for` looks for `of` and `by` in the header text without
  // skipping comments or regular expressions. A `)`, a `}` or the word `by`
  // in them breaks the header.
  // Shrunk: `#for (item of list /* } */ by item.id) { <p /> }`
  it.fails('finding 1: #for header with a comment or a regular expression', () => {
    const noise = fc.constantFrom(
      ' /* } */',
      ' /* ) */',
      ' /* by */',
      '.filter((i) => /[}]/.test(i))',
      ".filter((i) => /'/.test(i))",
    );
    expect(
      report(
        fc.property(
          listExpression,
          noise,
          fc.constantFrom('', ' by item.id'),
          (list, extra, by) => {
            return attempt(`#for (item of ${list}${extra}${by}) {\n<p />\n}`).ok;
          },
        ),
      ),
    ).toBe('');
  });

  // Finding 2. A `//` comment at the end of a block header swallows the `}`
  // that the compiler writes after it, so the output does not parse and the
  // error points at the wrong line.
  // Shrunk: `#if (a // note\n) { <p /> }`
  it.fails('finding 2: line comment at the end of a block header', () => {
    const header = fc.constantFrom(
      '#if (a // note\n)',
      '#repeat (a // note\n)',
      '#portal (a // note\n)',
      '#for (item of list // note\n)',
      '#for (item of list by item.id // note\n)',
    );
    expect(report(fc.property(header, (start) => attempt(`${start} {\n<p />\n}`).ok))).toBe('');
  });

  // Finding 3. A dynamic tag that ends the file, after a `<script>` or a
  // `<style>` with an interpolation, gets its closing `; })()}` in the
  // script. The error points at the end of the script.
  // Shrunk: `<script></script><{t}/>`
  it.fails('finding 3: dynamic tag at the end of a file', () => {
    const before = fc.constantFrom(
      '<script></script>',
      '<script>let t = 1;</script>',
      '<style>.a { width: ${t}; }</style>',
    );
    const tag = fc.constantFrom('<{t}/>', '<{t}></>', '<{t}>x</>');
    expect(
      report(fc.property(before, tag, (first, second) => attempt(`${first}${second}`).ok)),
    ).toBe('');
  });

  // Finding 4. An unbalanced `]`, `)` or `::` in a selector throws the raw
  // `Error` of postcss-selector-parser, not an SFCError.
  // Shrunk: `<style>] {}</style><p />`
  it.fails('finding 4: unbalanced selector throws a raw Error', () => {
    const selector = fc.constantFrom(']', 'a]', 'a)', 'a::', '.a].b');
    expect(
      report(
        fc.property(selector, (text) => {
          const result = attempt(`<style>${text} {}</style><p />`);
          return result.ok || result.error instanceof SFCError;
        }),
      ),
    ).toBe('');
  });
});
