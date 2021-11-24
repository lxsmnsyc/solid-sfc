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

interface SetupCode {
  type: 'setup';
  code: string;
  line: number;
}

interface RenderCode {
  type: 'render';
  code: string;
  line: number;
}

type SolidCode = SetupCode | RenderCode;

async function parse(name: string, code: string): Promise<SourceNode> {
  const lines = code.split('\n');

  let buffer = '';
  let startIndex = 0;

  const codes: SolidCode[] = [];

  // group lines of code
  let inSetup = false;
  for (let i = 0, len = lines.length; i < len; i += 1) {
    if (lines[i].trim() === TERMINATOR) {
      codes.push({
        type: inSetup ? 'setup' : 'render',
        code: buffer,
        line: startIndex,
      });
      buffer = '';
      inSetup = !inSetup;
      startIndex = i + 1;
    } else {
      buffer += `${lines[i]}\n`;
    }
  }
  codes.push({
    type: inSetup ? 'setup' : 'render',
    code: buffer,
    line: startIndex,
  });

  const setup = new SourceNode();
  const render = new SourceNode();

  for (let i = 0, len = codes.length; i < len; i += 1) {
    const node = codes[i];
    if (/\S/.test(node.code)) {
      if (node.type === 'setup') {
        setup.add(new SourceNode(
          node.line + 1,
          0,
          name,
          node.code,
        ));
      } else {
        // eslint-disable-next-line no-await-in-loop
        const result = await babel.transformAsync(`<>${node.code}</>`, {
          sourceMaps: true,
          plugins: [
            [jsxPlugin, {}],
            [solidSFCJSXPlugin, {}],
          ],
          parserOpts: {
            sourceFilename: name,
            startLine: node.line + 1,
          },
        });

        if (result && result.code && result.map) {
          const codeNode = SourceNode.fromStringWithSourceMap(
            result.code,
            // eslint-disable-next-line no-await-in-loop
            await new SourceMapConsumer(result.map),
          );
          render.add(['{(()=>{return ', codeNode, '})()}']);
        }
      }
    }
  }

  const root = new SourceNode(
    null,
    null,
    name,
    [],
  );
  root.add(setup);
  root.add('export default <>');
  root.add(render);
  root.add('</>');
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
