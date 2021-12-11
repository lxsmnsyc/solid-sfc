import * as babel from '@babel/core';
import { SourceMapConsumer, SourceNode } from 'source-map';
import solidReactivityPlugin from 'babel-plugin-solid-labels';
import jsxPlugin from '@babel/plugin-syntax-jsx';
import solid from 'babel-preset-solid';
import typescript from '@babel/preset-typescript';
import solidSFCPlugin from './babel-sfc';
import solidSFCJSXPlugin from './solid-sfc-jsx';

const TERMINATOR = '---';

export interface BabelOptions {
  plugins?: babel.PluginItem[];
  presets?: babel.PluginItem[];
}

export interface TransformOptions {
  filename?: string;
  target?: 'ssr' | 'dom' | 'preserve';
  hydratable?: boolean;
  dev?: boolean;
  sourcemap?: boolean;
  babel?: BabelOptions;
}

export interface SourceMap {
  file?: string;
  mappings: string;
  names: string[];
  sourceRoot?: string;
  sources: string[];
  sourcesContent?: string[];
  version: number;
}

export interface Output {
  code: string;
  map?: SourceMap;
}

async function precompile(name: string, base: string, offset = 1): Promise<SourceNode> {
  const result = await babel.transformAsync(base, {
    sourceMaps: true,
    plugins: [
      [jsxPlugin, {}],
      [solidSFCJSXPlugin, {}],
    ],
    parserOpts: {
      sourceFilename: name,
      startLine: offset,
    },
  });

  if (result && result.code && result.map) {
    return SourceNode.fromStringWithSourceMap(
      result.code,
      await new SourceMapConsumer(result.map),
    );
  }
  return new SourceNode();
}

async function parse(name: string, code: string): Promise<SourceNode> {
  const lines = code.split('\n');

  let setup = '';
  let render = '';

  let inSetup = false;

  for (let i = 0, len = lines.length; i < len; i += 1) {
    if (lines[i].trim() === TERMINATOR) {
      inSetup = !inSetup;
      setup += '\n';
      render += '\n';
    } else {
      setup += inSetup ? `${lines[i]}\n` : '\n';
      render += inSetup ? '\n' : `${lines[i]}\n`;
    }
  }
  const root = new SourceNode(
    null,
    null,
    name,
    [],
  );
  const setupNode = await precompile(name, setup);
  root.add(setupNode);
  root.add('export default ');
  root.add(await precompile(
    name,
    `<>${render}</>`,
  ));
  return root;
}

export default async function transform(code: string, options?: TransformOptions): Promise<Output> {
  const name = options?.filename ?? 'index.solid';

  const root = await parse(name, code);

  const presets = [
    [typescript, {}],
  ];

  const dev = options?.dev;
  const target = options?.target ?? 'dom';

  const plugins = [
    [solidSFCPlugin, { }],
    [solidReactivityPlugin, { dev }],
  ];

  if (target === 'preserve') {
    plugins.push([jsxPlugin, {}]);
  } else {
    presets.push([
      solid,
      { generate: target ?? 'dom', hydratable: options?.hydratable },
    ]);
  }

  const output = root.toStringWithSourceMap();
  const result = await babel.transformAsync(output.code, {
    sourceMaps: options?.sourcemap || dev,
    filename: name,
    presets: [
      ...presets,
      ...(options?.babel?.presets ?? []),
    ],
    plugins: [
      ...plugins,
      ...(options?.babel?.plugins ?? []),
    ],
    inputSourceMap: output.map.toJSON(),
  });

  return {
    code: result?.code ?? '',
    map: result?.map ?? undefined,
  };
}
