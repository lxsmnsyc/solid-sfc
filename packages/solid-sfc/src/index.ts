import * as htmlparser2 from 'htmlparser2';
import * as babel from '@babel/core';
import * as domhandler from 'domhandler';
import render from 'dom-serializer';
import solidReactivityPlugin from 'babel-plugin-solid-labels';
import solid from 'babel-preset-solid';
import typescript from '@babel/preset-typescript';
import solidSFCPlugin from './babel-sfc';

export interface BabelOptions {
  plugins?: babel.PluginItem[];
  presets?: babel.PluginItem[];
}

const SOLID_SETUP = 'solid:setup';
const SOLID_RENDER = 'solid:render';
const SOLID_SLOT = 'solid:slot';

const REPLACEMENTS: Record<string, string> = {
  'solid:for': 'For',
  'solid:switch': 'Switch',
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

function transformToJSX(nodes: domhandler.Node[], fragment = true): string {
  function transformNode(node: domhandler.Node): string {
    if (domhandler.isTag(node)) {
      if (node.name === SOLID_SLOT && fragment) {
        throw new Error(`Unexpected <${SOLID_SLOT}> inside a fragment.`);
      }
      if (node.name === SOLID_SETUP || node.name === SOLID_RENDER) {
        throw new Error(`Unexpected <${node.name}> inside <${SOLID_RENDER}>`);
      }
      // Normalize attributes
      let attributes = [];
      for (let i = 0, len = node.attributes.length; i < len; i += 1) {
        const attribute = node.attributes[i];
        const { value, name } = attribute;
        if (/^{(.*)}$/.test(value)) {
          attributes.push(`${name}=${value}`);
        } else {
          attributes.push(`${name}="${value}"`);
        }
      }

      // find slots
      let normalNodes: domhandler.Node[] = [];
      for (let i = 0, len = node.children.length; i < len; i += 1) {
        const childNode = node.children[i];
        if (domhandler.isTag(childNode)) {
          if (childNode.name === SOLID_SLOT) {
            if (!childNode.attribs.name) {
              throw new Error(`Unexpected unnnamed slot`);
            }
            const result = transformToJSX(childNode.children);
            attributes.push(`${childNode.attribs.name}={${result}}`);
          } else {
            normalNodes.push(childNode);
          }
        } else {
          normalNodes.push(childNode);
        }
      }

      const children = transformToJSX(normalNodes, false);
      const name = node.name in REPLACEMENTS ? REPLACEMENTS[node.name] : node.name;
      return `<${name} ${attributes.join(' ')}>${children}</${name}>`;
    }
    if (domhandler.isText(node)) {
      return node.data;
    }
    return '';
  }

  let output = '';

  for (let i = 0, len = nodes.length; i < len; i += 1) {
    output += transformNode(nodes[i]);
  }

  if (nodes.length > 1 && fragment) {
    return `<>${output}</>`
  }

  return output;
}

export interface TransformOptions {
  filename: string;
  target: 'server' | 'client' | 'preserve';
  babel?: BabelOptions;
}

export default async function transform(code: string, options?: TransformOptions) {
  const doc = htmlparser2.parseDocument(code, {
    lowerCaseAttributeNames: false,
    lowerCaseTags: false,
    recognizeSelfClosing: true,
  });

  // Normalize children
  let setupPart: domhandler.Element | undefined;
  let renderPart: domhandler.Element | undefined;

  let node = doc.firstChild;
  while (node) {
    if (domhandler.isTag(node)) {
      switch (node.name) {
        case SOLID_SETUP: {
          if (setupPart) {
            throw new Error(`Unexpected <${SOLID_SETUP}>`);
          }
          setupPart = node;
        }
          break;
        case SOLID_RENDER: {
          if (renderPart) {
            throw new Error(`Unexpected <${SOLID_RENDER}>`);
          }
          renderPart = node;
        }
          break;
        default:
          break;
      }
  
    }
    node = node.nextSibling;
  }

  let outputCode = '';

  if (setupPart) {
    console.log(setupPart);
    outputCode += render(setupPart.children, {
      decodeEntities: false,
    });
  }
  if (renderPart) {
    outputCode += `export default ${transformToJSX(renderPart.children)}`;
  }

  const result = await babel.transformAsync(outputCode, {
    filename: options?.filename ?? 'index.js',
    presets: [
      [solid, {}],
      [typescript, {}],
    ],
    plugins: [
      [solidSFCPlugin, {}],
      [solidReactivityPlugin, {}],
    ],
  });

  return result?.code ?? '';
}
