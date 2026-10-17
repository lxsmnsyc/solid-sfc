import { createRequire } from 'node:module';
import path from 'node:path';
import { createSolidLanguagePlugin } from '@solid-sfc/language-core';

const require = createRequire(import.meta.url);

/**
 * Runs `tsc` with support for `.solid` files. TypeScript 7 has no JavaScript
 * API, so this uses the TypeScript 6 compiler, installed as `typescript-api`.
 */
export function run(): void {
  const { runTsc } = require('@volar/typescript/lib/quickstart/runTsc') as {
    runTsc(tscPath: string, extensions: string[], getLanguagePlugins: () => unknown[]): void;
  };
  const errors = new Map<string, string>();

  // `.solid` syntax errors are not TypeScript errors, so they are printed
  // separately and fail the run.
  const exit = process.exit.bind(process);
  process.exit = ((code?: number) => {
    for (const message of errors.values()) {
      process.stderr.write(`${message}\n`);
    }
    return exit(errors.size > 0 ? 1 : code);
  }) as typeof process.exit;

  runTsc(require.resolve('typescript-api/lib/tsc'), ['.solid'], () => [
    createSolidLanguagePlugin({
      onError(fileName, error) {
        const message = error.message.replace(/ \([^()]*:\d+:\d+\)$/, '');
        errors.set(
          fileName,
          `${path.relative(process.cwd(), fileName)}(${error.line},${error.column}): error SFC: ${message}`,
        );
      },
    }),
  ]);
}
