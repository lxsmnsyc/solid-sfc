import * as htmlparser from 'node-html-parser';
import * as babel from '@babel/core';
import { SourceNode } from 'source-map';
import solidReactivityPlugin from 'babel-plugin-solid-labels';
import jsxPlugin from '@babel/plugin-syntax-jsx';
import solid from 'babel-preset-solid';
import typescript from '@babel/preset-typescript';
import solidSFCPlugin from './babel-sfc';

function createSourceMapBase(code: string): string[] {
  return code.split('\n');
}

interface Position {
  line: number;
  column: number;
}

interface SourceRange {
  start: Position;
  end: Position;
}

function mapRangeToSource(source: string[], start: number, end: number): SourceRange {
  let size = 0;

  let startPos: Position | undefined;
  let endPos: Position | undefined;

  for (let i = 0, len = source.length; i < len; i += 1) {
    const chunk = source[i].length + 1;
    // Check if index is within the chunk
    if (start < size + chunk && !startPos) {
      startPos = {
        line: i + 1,
        column: start - size,
      };
    }
    if (end < size + chunk && !endPos) {
      endPos = {
        line: i + 1,
        column: end - size,
      };
    }

    size += chunk;
  }

  if (!startPos || !endPos) {
    throw new Error('Unexpected missing range');
  }

  return {
    start: startPos,
    end: endPos,
  };
}

interface Source {
  code: string[];
  name: string;
}


const SOLID_SETUP = 'solid:setup';
const SOLID_FRAGMENT = 'solid:fragment';
const SOLID_SLOT = 'solid:slot';
const SOLID_CHILDREN = 'solid:children';

const SPREAD = '@spread';

const REPLACEMENTS: Record<string, string> = {
  'solid:for': 'For',
  'solid:switch': 'Switch',
  'solid:match': 'Match',
  'solid:show': 'Show',
  'solid:index': 'Index',
  'solid:error-boundary': 'ErrorBoundary',
  'solid:suspense': 'Suspense',
  'solid:suspense-list': 'SuspenseList',
  'solid:dynamic': 'Dynamic',
  'solid:portal': 'Portal',
  'solid:assets': 'Assets',
  'solid:hydration-script': 'HydrationScript',
  'solid:no-hydration': 'NoHydration',
};

function transformToJSX(source: Source, nodes: htmlparser.Node[], fragment = true): (SourceNode | string)[] {
  function transformNode(node: htmlparser.Node): SourceNode {
    if (node instanceof htmlparser.HTMLElement) {
      if (node.rawTagName === SOLID_FRAGMENT && fragment) {
        throw new Error(`Unexpected <${SOLID_FRAGMENT}> inside a fragment.`);
      }
      if (node.rawTagName === SOLID_SLOT) {
        if (!node.attrs.name) {
          throw new Error(`Missing "name" from <${SOLID_SLOT}>`);
        }
        const range = node.range;
        const mappedPosition = mapRangeToSource(source.code, ...range);
        return new SourceNode(
          mappedPosition.start.line,
          mappedPosition.start.column,
          source.name,
          `{props.${node.attrs.name}}`,
        );
      }
      if (node.rawTagName === SOLID_CHILDREN) {
        const range = node.range;
        const mappedPosition = mapRangeToSource(source.code, ...range);
        return new SourceNode(
          mappedPosition.start.line,
          mappedPosition.start.column,
          source.name,
          `{props.children}`,
        );
      }
      // Normalize attributes
      const attributes: (string | SourceNode)[] = [];
      const current = node.attributes;
      const keys = Object.keys(current);
      for (let i = 0, len = keys.length; i < len; i += 1) {
        const name = keys[i];
        const value = current[name];
        if (name === SPREAD) {
          if (/^{(.*)}$/.test(value)) {
            attributes.push(`{...${value.substring(1, value.length - 1)}}`);
          } else {
            throw new Error(`Unexpected ${SPREAD}`);
          }
        } else if (/^{(.*)}$/.test(value)) {
          attributes.push(`${name}=${value}`);
        } else if (value !== '') {
          attributes.push(`${name}="${value}"`);
        } else {
          attributes.push(name);
        }
      }

      // find slots
      let normalNodes: htmlparser.Node[] = [];
      for (let i = 0, len = node.childNodes.length; i < len; i += 1) {
        const childNode = node.childNodes[i];
        if (childNode instanceof htmlparser.HTMLElement) {
          if (childNode.rawTagName === SOLID_FRAGMENT) {
            if (!childNode.attrs.name) {
              throw new Error(`Unexpected unnnamed <${SOLID_FRAGMENT}>`);
            }
            const result = transformToJSX(source, childNode.childNodes);
            const range = childNode.range;
            const mappedPosition = mapRangeToSource(source.code, ...range);
            attributes.push(new SourceNode(
              mappedPosition.start.line,
              mappedPosition.start.column,
              source.name,
              [`${childNode.attrs.name}={`, ...result, '}'],
            ));
          } else {
            normalNodes.push(childNode);
          }
        } else {
          normalNodes.push(childNode);
        }
      }

      const name = node.rawTagName in REPLACEMENTS ? REPLACEMENTS[node.rawTagName] : node.rawTagName;
      const range = node.range;
      const mappedPosition = mapRangeToSource(source.code, ...range);
      if (normalNodes.length) {
        const children = transformToJSX(source, normalNodes, false);
        return new SourceNode(
          mappedPosition.start.line,
          mappedPosition.start.column,
          source.name,
          [`<${name} `, ...attributes, '>', ...children, `</${name}>`],
        );
      }
      return new SourceNode(
        mappedPosition.start.line,
        mappedPosition.start.column,
        source.name,
        [`<${name} `, ...attributes, '/>'],
      );
    }
    if (node instanceof htmlparser.TextNode) {
      const range = node.range;
      const mappedPosition = mapRangeToSource(source.code, ...range);
      return new SourceNode(
        mappedPosition.start.line,
        mappedPosition.start.column,
        source.name,
        node.text,
      );
    }
    return new SourceNode();
  }

  const output: SourceNode[] = [];

  for (let i = 0, len = nodes.length; i < len; i += 1) {
    output.push(transformNode(nodes[i]));
  }

  if (nodes.length > 1 || fragment) {
    return ['<>', ...output, '</>'];
  }

  return output;
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

export default async function transform(code: string, options?: TransformOptions): Promise<Output> {
  const doc = htmlparser.parse(code, {
    blockTextElements: {
      'solid:setup': true,
      script: true,
      noscript: true,
      style: true,
      pre: true,
    },
  });

  // Normalize children
  let setupPart: htmlparser.HTMLElement[] = [];
  let renderPart: htmlparser.Node[] = [];

  for (let i = 0, len = doc.childNodes.length; i < len; i += 1) {
    const node = doc.childNodes[i];
    if (node instanceof htmlparser.HTMLElement) {
      switch (node.rawTagName) {
        case SOLID_SETUP: {
          setupPart.push(node);
        }
          break;
        default:
          renderPart.push(node);
          break;
      }
    }
  }

  const source: Source = {
    name: options?.filename ?? 'index.js',
    code: createSourceMapBase(code),
  };
  const root = new SourceNode();

  for (let i = 0, len = setupPart.length; i < len; i += 1) {
    const range = setupPart[i].range;
    const mappedPosition = mapRangeToSource(source.code, ...range);
    root.add(new SourceNode(
      mappedPosition.start.line,
      mappedPosition.start.column,
      source.name,
      setupPart[i].text,
    ));
  }
  if (renderPart.length) {
    root.add('export default');
    root.add(transformToJSX(source, renderPart));
  }

  const presets = [
    [typescript, {}],
  ];

  const dev = options?.dev;
  const hmr = options?.hmr ?? 'esm';
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
    filename: options?.filename ?? 'index.js',
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
