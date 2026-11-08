/**
 * A context created in `<script module>` is exported from the `.solid` file,
 * so the component can provide it and other files can read it (issue #1).
 */
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';
import esbuildPlugin from '../src/esbuild.ts';

const fixture = fileURLToPath(new URL('fixtures/context', import.meta.url));
const outputs = mkdtempSync(path.join(tmpdir(), 'solid-sfc-context-'));

afterAll(() => {
  rmSync(outputs, { recursive: true, force: true });
});

function compileFixture(name: string): string {
  const filename = path.join(fixture, name);
  return compile(readFileSync(filename, 'utf8'), { filename }).code;
}

describe('context in <script module>', () => {
  it('exports the context and provides it from the component', () => {
    const provider = compileFixture('ThemeProvider.solid');
    // The module script stays at the top level, outside the component.
    expect(provider).toContain(
      "export const ThemeContext = createContext<'light' | 'dark'>('light');",
    );
    expect(provider.indexOf('export const ThemeContext')).toBeLessThan(
      provider.indexOf('export default function ThemeProvider'),
    );
    // In Solid 2.0 the context is its own provider component.
    expect(provider).toContain('<ThemeContext value={props.theme}>{props.children}</ThemeContext>');

    const label = compileFixture('ThemeLabel.solid');
    expect(label).toContain("import { ThemeContext } from './ThemeProvider.solid';");
    expect(label).toContain('const theme = useContext(ThemeContext);');
  });

  it('renders the provided value in a consumer file', async () => {
    const { build } = await import('esbuild');
    const outfile = path.join(outputs, 'main.mjs');
    // Bundles Solid too, with its server build, so the output runs in Node.
    await build({
      entryPoints: [path.join(fixture, 'main.js')],
      bundle: true,
      outfile,
      platform: 'node',
      format: 'esm',
      plugins: [esbuildPlugin({ compiler: { generate: 'ssr' } })],
      logLevel: 'silent',
    });
    const { html } = await import(pathToFileURL(outfile).href);
    // Outside the provider the label reads the default value.
    expect(html).toBe('<p>light</p><p>dark</p>');
  });
});
