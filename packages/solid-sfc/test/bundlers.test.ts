/**
 * Builds a small app with each bundler that unplugin supports, apart from
 * Vite, which the examples cover.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import esbuildPlugin from '../src/esbuild.ts';
import rolldownPlugin from '../src/rolldown.ts';
import rollupPlugin from '../src/rollup.ts';
import rspackPlugin from '../src/rspack.ts';
import webpackPlugin from '../src/webpack.ts';

const fixture = fileURLToPath(new URL('fixtures/app', import.meta.url));
const entry = path.join(fixture, 'main.js');
const outputs = mkdtempSync(path.join(tmpdir(), 'solid-sfc-bundlers-'));

afterAll(() => {
  rmSync(outputs, { recursive: true, force: true });
});

/** The text of every file a bundler wrote, by extension. */
function read(dir: string): { js: string; css: string } {
  const files = readdirSync(dir, { recursive: true }) as string[];
  const text = (...extensions: string[]) =>
    files
      .filter((file) => extensions.some((extension) => file.endsWith(extension)))
      .map((file) => readFileSync(path.join(dir, file), 'utf8'))
      .join('\n');
  return { js: text('.js', '.mjs'), css: text('.css') };
}

/** Checks that the components compiled to Solid's DOM output, with scoped styles. */
function expectApp({ js, css }: { js: string; css: string }): void {
  // Solid's compiler turns the markup into templates.
  expect(js).toMatch(/<h1 s-[a-z0-9]+>/);
  expect(js).toContain('Bundled');
  expect(js).not.toContain('$signal');
  expect(js).not.toMatch(/#for|[^$]\$props\(/);
  expect(css).toMatch(/h1\[s-[a-z0-9]+\]/);
  expect(css).toContain('rebeccapurple');
  expect(css).toMatch(/var\(--s-[a-z0-9]+-0\)/);
}

describe('bundlers', () => {
  it('esbuild', async () => {
    const { build } = await import('esbuild');
    const outdir = path.join(outputs, 'esbuild');
    await build({
      entryPoints: [entry],
      bundle: true,
      outdir,
      plugins: [esbuildPlugin()],
      external: ['solid-js', '@solidjs/web', 'solid-sfc/runtime'],
      format: 'esm',
      logLevel: 'silent',
    });
    const output = read(outdir);
    expect(output.css).not.toContain('sourceMappingURL');
    expectApp(output);
  });

  it.each([
    ['rollup', rollupPlugin, () => import('rollup').then((module) => module.rollup)],
    ['rolldown', rolldownPlugin, () => import('rolldown').then((module) => module.rolldown)],
  ] as const)('%s', async (_, plugin, load) => {
    expect.hasAssertions();
    const bundle = await load();
    let css = '';
    // Rollup and Rolldown need a plugin for stylesheets. This one collects them.
    const styles = {
      name: 'styles',
      transform(code: string, id: string) {
        if (!id.endsWith('.css')) {
          return null;
        }
        css += code;
        // Rolldown reads `.css` modules as CSS unless the type is set.
        return { code: 'export {};', map: null, moduleType: 'js' };
      },
    };
    const build = await bundle({
      input: entry,
      plugins: [plugin(), styles],
      external: [/^solid-js/, /^@solidjs\//, /^solid-sfc\//],
    } as never);
    const { output } = await build.generate({ format: 'esm' });
    const js = output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n');
    expectApp({ js, css });
  });

  it.each([
    ['webpack', webpackPlugin, () => import('webpack').then((module) => module.default)],
    ['rspack', rspackPlugin, () => import('@rspack/core').then((module) => module.rspack)],
  ] as const)('%s', async (name, plugin, load) => {
    expect.hasAssertions();
    const bundler = (await load()) as unknown as (config: object) => {
      run(
        callback: (
          error: Error | null,
          stats?: { hasErrors(): boolean; toString(): string },
        ) => void,
      ): void;
    };
    const outdir = path.join(outputs, name);
    const compiler = bundler({
      mode: 'production',
      entry,
      output: { path: outdir, module: true },
      optimization: { minimize: false },
      plugins: [plugin()],
      externals: { 'solid-js': 'solid-js', '@solidjs/web': '@solidjs/web' },
      externalsType: 'module',
      experiments: { css: true, outputModule: true },
      // The stylesheet of a component ends with `.css`, like any other.
      module: { rules: [{ test: /\.css$/, type: 'css' }] },
    });
    await new Promise<void>((resolve, reject) => {
      compiler.run((error, stats) => {
        if (error || stats?.hasErrors()) {
          reject(error ?? new Error(stats?.toString()));
        } else {
          resolve();
        }
      });
    });
    expectApp(read(outdir));
  });
});
