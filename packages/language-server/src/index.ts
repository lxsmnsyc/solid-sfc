import { createSolidLanguagePlugin, getFoldingRanges } from '@solid-sfc/language-core';
import type { Diagnostic, FoldingRange, LanguageServicePlugin } from '@volar/language-server';
import {
  DiagnosticSeverity,
  FoldingRangeKind,
  createConnection,
  createServer,
  createTypeScriptProject,
} from '@volar/language-server/node.js';
import { SFCError, compileStructure } from 'solid-sfc';
import typescript from 'typescript-api';
import { create as createCssServices } from 'volar-service-css';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import type { URI } from 'vscode-uri';

/** Reports `.solid` syntax errors, which TypeScript does not see. */
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
            compileStructure(document.getText(), { filename: document.uri });
            return [];
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
      ],
    ),
  );
  connection.onInitialized(server.initialized);
  connection.onShutdown(server.shutdown);
}
