import { createSolidLanguagePlugin } from '@solid-sfc/language-core';
import type { Diagnostic, LanguageServicePlugin } from '@volar/language-server';
import {
  DiagnosticSeverity,
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
      [...createTypeScriptServices(ts), createCssServices(), createSyntaxDiagnosticsPlugin()],
    ),
  );
  connection.onInitialized(server.initialized);
  connection.onShutdown(server.shutdown);
}
