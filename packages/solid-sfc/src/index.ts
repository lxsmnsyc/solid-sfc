import * as babel from '@babel/core';
import { SourceMapConsumer, SourceNode } from 'source-map';
import solidReactivityPlugin from 'babel-plugin-solid-labels';
import jsxPlugin from '@babel/plugin-syntax-jsx';
import solid from 'babel-preset-solid';
import typescript from '@babel/preset-typescript';
import solidSFCPlugin from './babel-sfc';
import solidSFCJSXPlugin from './solid-sfc-jsx';

const TERMINATOR = '---';

function trimSemiColon(str: string): string {
  const index = str.lastIndexOf(';');
  if (index > 0) {
    return `${str.substring(0, index)}${str.substring(index + 1)}`;
  }
  return str;
}

export interface BabelOptions {
  plugins?: babel.PluginItem[];
  presets?: babel.PluginItem[];
}

export interface TransformOptions {
  filename?: string;
  target?: 'ssr' | 'dom' | 'preserve';
  dev?: boolean;
  sourcemap?: boolean;
  hmr?: 'esm' | 'standard';
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

async function parse(name: string, code: string): Promise<SourceNode> {
  const lines = code.split('\n');

  const setup = new SourceNode();
  const render = new SourceNode();

  let inSetup = false;

  for (let i = 0, len = lines.length; i < len; i += 1) {
    if (lines[i].trim() === TERMINATOR) {
      inSetup = !inSetup;
    } else {
      (inSetup ? setup : render).add(new SourceNode(
        i + 1,
        0,
        name,
        `${lines[i]}\n`,
      ));
    }
  }
  const root = new SourceNode(
    null,
    null,
    name,
    [],
  );
  root.add(setup);
  const renderCode = render.toStringWithSourceMap();
  const renderResult = await babel.transformAsync(`<>${renderCode.code}</>`, {
    sourceMaps: true,
    plugins: [
      [jsxPlugin, {}],
      [solidSFCJSXPlugin, {}],
    ],
    inputSourceMap: renderCode.map.toJSON(),
  });

  if (renderResult && renderResult.code && renderResult.map) {
    const codeNode = SourceNode.fromStringWithSourceMap(
      trimSemiColon(renderResult.code),
      // eslint-disable-next-line no-await-in-loop
      await new SourceMapConsumer(renderResult.map),
    );
    root.add(['export default <>', codeNode, '</>']);
  }
  return root;
}

export default async function transform(code: string, options?: TransformOptions): Promise<Output> {
  const name = options?.filename ?? 'index.solid';

  const root = await parse(name, code);

  const presets = [
    [typescript, {}],
  ];

  const dev = options?.dev;
  const hmr = options?.hmr;
  const target = options?.target ?? 'dom';

  const plugins = [
    [solidSFCPlugin, { dev: dev && target !== 'preserve', hmr }],
    [solidReactivityPlugin, { dev }],
  ];

  if (target === 'preserve') {
    plugins.push([jsxPlugin, {}]);
  } else {
    presets.push([
      solid,
      { generate: target ?? 'dom', hydratable: target === 'ssr' },
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
