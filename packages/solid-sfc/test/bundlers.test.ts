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

/** The JavaScript that a bundler wrote. */
function read(dir: string): string {
  const files = readdirSync(dir, { recursive: true }) as string[];
  expect(files.filter((file) => file.endsWith('.css'))).toEqual([]);
  return files
    .filter((file) => file.endsWith('.js') || file.endsWith('.mjs'))
    .map((file) => readFileSync(path.join(dir, file), 'utf8'))
    .join('\n');
}

/**
 * Checks that the components compiled to Solid's DOM output, and that each
 * one adds its scoped stylesheet with `useStyle`.
 */
function expectApp(js: string): void {
  // Solid's compiler turns the markup into templates.
  expect(js).toMatch(/<h1 s-[a-z0-9]+>/);
  expect(js).toContain('Bundled');
  expect(js).not.toContain('$signal');
  expect(js).not.toMatch(/#for|[^$]\$props\(/);
  expect(js).toMatch(/useStyle/);
  expect(js).toMatch(/h1\[s-[a-z0-9]+\]/);
  expect(js).toContain('rebeccapurple');
  expect(js).toMatch(/var\(--s-[a-z0-9]+-0\)/);
}

const EXTERNAL = ['solid-js', '@solidjs/web', 'solid-sfc/runtime'];

describe('bundlers', () => {
  it('esbuild', async () => {
    expect.hasAssertions();
    const { build } = await import('esbuild');
    const outdir = path.join(outputs, 'esbuild');
    await build({
      entryPoints: [entry],
      bundle: true,
      outdir,
      plugins: [esbuildPlugin()],
      external: EXTERNAL,
      format: 'esm',
      logLevel: 'silent',
    });
    expectApp(read(outdir));
  });

  it.each([
    ['rollup', rollupPlugin, () => import('rollup').then((module) => module.rollup)],
    ['rolldown', rolldownPlugin, () => import('rolldown').then((module) => module.rolldown)],
  ] as const)('%s', async (_, plugin, load) => {
    expect.hasAssertions();
    const bundle = await load();
    const build = await bundle({
      input: entry,
      plugins: [plugin()],
      external: [/^solid-js/, /^@solidjs\//, /^solid-sfc\//],
    } as never);
    const { output } = await build.generate({ format: 'esm' });
    expectApp(output.map((chunk) => ('code' in chunk ? chunk.code : '')).join('\n'));
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
      externals: Object.fromEntries(EXTERNAL.map((module) => [module, module])),
      externalsType: 'module',
      experiments: { outputModule: true },
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
