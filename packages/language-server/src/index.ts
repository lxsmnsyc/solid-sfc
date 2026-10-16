import {
  createSolidLanguagePlugin,
  getClosingTag,
  getCodeActions,
  getCompletions,
  getDocumentSymbols,
  getFoldingRanges,
} from '@solid-sfc/language-core';
import type { DocumentSymbol as SolidSymbol } from '@solid-sfc/language-core';
import type {
  CodeAction,
  CompletionItem,
  Diagnostic,
  DocumentSymbol,
  FoldingRange,
  LanguageServicePlugin,
} from '@volar/language-server';
import {
  CompletionItemKind,
  DiagnosticSeverity,
  InsertTextFormat,
  FoldingRangeKind,
  SymbolKind,
  createConnection,
  createServer,
  createTypeScriptProject,
} from '@volar/language-server/node.js';
import { SFCError, compileStructure } from 'solid-sfc';
import typescript from 'typescript-api';
import { create as createCssServices } from 'volar-service-css';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import type { URI } from 'vscode-uri';

/** Reports `.solid` syntax errors and warnings, which TypeScript does not see. */
export function createSyntaxDiagnosticsPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-syntax',
    capabilities: {
      diagnosticProvider: {
        interFileDependencies: false,
        workspaceDiagnostics: false,
      },
    },
    create() {
      return {
        provideDiagnostics(document) {
          if (document.languageId !== 'solid') {
            return [];
          }
          try {
            // Like the editor's TSX, so warnings that only apply without a bundler, such as
            // on SCSS stylesheets, are left out.
            const { warnings } = compileStructure(document.getText(), {
              filename: document.uri,
              typeCheck: true,
            });
            return warnings.map((warning): Diagnostic => ({
              range: {
                start: document.positionAt(warning.offset),
                end: document.positionAt(warning.offset + warning.length),
              },
              message: warning.message,
              code: warning.code,
              severity: DiagnosticSeverity.Warning,
              source: 'solid-sfc',
            }));
          } catch (error) {
            if (!(error instanceof SFCError)) {
              throw error;
            }
            const position = document.positionAt(error.offset);
            const diagnostic: Diagnostic = {
              range: { start: position, end: position },
              message: error.message.replace(/ \([^()]*:\d+:\d+\)$/, ''),
              severity: DiagnosticSeverity.Error,
              source: 'solid-sfc',
            };
            return [diagnostic];
          }
        },
      };
    },
  };
}

/**
 * Folds the parts of a `.solid` file that only exist in it, such as
 * `<script>` blocks and `#if` blocks. TypeScript and CSS fold the code
 * inside them.
 */
export function createFoldingPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-folding',
    capabilities: {
      foldingRangeProvider: true,
    },
    create() {
      return {
        provideFoldingRanges(document) {
          if (document.languageId !== 'solid') {
            return [];
          }
          const ranges: FoldingRange[] = [];
          for (const range of getFoldingRanges(document.getText())) {
            const startLine = document.positionAt(range.start).line;
            const endLine = document.positionAt(range.end).line;
            if (endLine > startLine) {
              ranges.push({
                startLine,
                endLine,
                kind: range.kind === 'comment' ? FoldingRangeKind.Comment : undefined,
              });
            }
          }
          return ranges;
        },
      };
    },
  };
}

const SYMBOL_KINDS: Record<SolidSymbol['kind'], SymbolKind> = {
  module: SymbolKind.Module,
  function: SymbolKind.Function,
  variable: SymbolKind.Variable,
  constant: SymbolKind.Constant,
  class: SymbolKind.Class,
  interface: SymbolKind.Interface,
  enum: SymbolKind.Enum,
};

/**
 * Adds the parts of a `.solid` file to the outline: `<script>` blocks with
 * their declarations, `<style>` blocks with their rules, and `#template`
 * declarations.
 */
export function createDocumentSymbolPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-symbols',
    capabilities: {
      documentSymbolProvider: true,
    },
    create() {
      return {
        provideDocumentSymbols(document) {
          if (document.languageId !== 'solid') {
            return [];
          }
          const convert = (symbol: SolidSymbol): DocumentSymbol => ({
            name: symbol.name,
            kind: SYMBOL_KINDS[symbol.kind],
            range: {
              start: document.positionAt(symbol.start),
              end: document.positionAt(symbol.end),
            },
            selectionRange: {
              start: document.positionAt(symbol.selectionStart),
              end: document.positionAt(symbol.selectionEnd),
            },
            children: symbol.children.map(convert),
          });
          return getDocumentSymbols(document.getText()).map(convert);
        },
      };
    },
  };
}

/** Inserts the closing tag after `>` ends an opening tag in the markup. */
export function createAutoCloseTagPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-auto-close',
    capabilities: {
      autoInsertionProvider: {
        triggerCharacters: ['>'],
        configurationSections: ['solid.autoClosingTags'],
      },
    },
    create(context) {
      return {
        async provideAutoInsertSnippet(document, selection, change) {
          if (
            document.languageId !== 'solid' ||
            !change.text.endsWith('>') ||
            (await context.env.getConfiguration?.<boolean>('solid.autoClosingTags')) === false
          ) {
            return undefined;
          }
          const tag = getClosingTag(document.getText(), document.offsetAt(selection));
          return tag && `$0${tag}`;
        },
      };
    },
  };
}

/** Completes control flow keywords and `solid:` elements in the markup. */
export function createCompletionPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-completion',
    capabilities: {
      completionProvider: { triggerCharacters: ['#', ':'] },
    },
    create() {
      return {
        provideCompletionItems(document, position) {
          if (document.languageId !== 'solid') {
            return undefined;
          }
          const offset = document.offsetAt(position);
          const items = getCompletions(document.getText(), offset).map((item): CompletionItem => ({
            label: item.label,
            detail: item.detail,
            kind: CompletionItemKind.Keyword,
            insertTextFormat: InsertTextFormat.Snippet,
            textEdit: {
              range: { start: document.positionAt(item.start), end: position },
              newText: item.snippet,
            },
          }));
          return { isIncomplete: false, items };
        },
      };
    },
  };
}

/** Wraps markup in a block, or extracts it to a `#template`. */
export function createCodeActionPlugin(): LanguageServicePlugin {
  return {
    name: 'solid-sfc-code-actions',
    capabilities: {
      codeActionProvider: { codeActionKinds: ['refactor.rewrite', 'refactor.extract'] },
    },
    create() {
      return {
        provideCodeActions(document, range) {
          if (document.languageId !== 'solid') {
            return undefined;
          }
          const actions = getCodeActions(
            document.getText(),
            document.offsetAt(range.start),
            document.offsetAt(range.end),
          );
          return actions.map((action): CodeAction => ({
            title: action.title,
            kind: action.kind,
            edit: {
              changes: {
                [document.uri]: action.edits.map((edit) => ({
                  range: {
                    start: document.positionAt(edit.start),
                    end: document.positionAt(edit.end),
                  },
                  newText: edit.text,
                })),
              },
            },
          }));
        },
      };
    },
  };
}

/**
 * Starts the language server over the connection the client opened.
 * TypeScript 7 has no JavaScript API, so the server uses its own copy of the
 * TypeScript 6 compiler.
 */
export function startServer(): void {
  // Volar's types name the `typescript` package, which is TypeScript 7 in
  // this workspace. The TypeScript 6 API is what Volar expects at runtime.
  const ts = typescript as never;
  const connection = createConnection();
  const server = createServer(connection);

  connection.listen();

  connection.onInitialize((params) =>
    server.initialize(
      params,
      createTypeScriptProject(ts, undefined, () => ({
        languagePlugins: [
          createSolidLanguagePlugin<URI>({}, (uri) => uri.fsPath.replaceAll('\\', '/')),
        ],
      })),
      [
        ...createTypeScriptServices(ts),
        createCssServices(),
        createSyntaxDiagnosticsPlugin(),
        createFoldingPlugin(),
        createDocumentSymbolPlugin(),
        createAutoCloseTagPlugin(),
        createCompletionPlugin(),
        createCodeActionPlugin(),
      ],
    ),
  );
  connection.onInitialized(server.initialized);
  connection.onShutdown(server.shutdown);
}
