/**
 * The page in the preview frame. It runs the compiled component that the
 * playground sends, with its own copy of Solid, so the component's DOM and
 * events belong to the frame.
 */
import * as web from '@solidjs/web';
import * as solid from 'solid-js';
import * as runtime from 'solid-sfc/runtime';

export interface PreviewMessage {
  /** The component as JavaScript, an ES module. It adds its own stylesheet. */
  code: string;
}

const MODULES: Record<string, unknown> = {
  'solid-js': solid,
  '@solidjs/web': web,
  'solid-sfc/runtime': runtime,
};

/** `{ a as b, c }` becomes `{ a: b, c }`. */
function destructure(names: string): string {
  return names.replace(/\b([\w$]+)\s+as\s+([\w$]+)/g, '$1: $2');
}

/**
 * Turns the module into the body of a function. Imports read from
 * `__import`, and the default export goes to `__exports`.
 */
function toFunctionBody(code: string): string {
  return code
    .replace(
      /^import\s+([\s\S]*?)\s+from\s+(["'])(.+?)\2;?/gm,
      (_, clause: string, _quote, source: string) => {
        const module = `__import(${JSON.stringify(source)})`;
        const parts: string[] = [];
        const named = /\{[\s\S]*\}/.exec(clause)?.[0];
        const namespace = /\*\s+as\s+([\w$]+)/.exec(clause)?.[1];
        const fallback = /^([\w$]+)/.exec(clause.trim())?.[1];
        if (named) {
          parts.push(`const ${destructure(named)} = ${module};`);
        }
        if (namespace) {
          parts.push(`const ${namespace} = ${module};`);
        }
        if (fallback && !clause.trim().startsWith('{')) {
          parts.push(`const ${fallback} = ${module}.default;`);
        }
        return parts.join(' ');
      },
    )
    .replace(/^import\s+(["']).+?\1;?/gm, '')
    .replace(/^export\s+default\s+/m, '__exports.default = ')
    .replace(/^export\s+/gm, '');
}

function importModule(source: string): unknown {
  const module = MODULES[source];
  if (!module) {
    throw new Error(
      `The preview cannot import "${source}". It can import solid-js, @solidjs/web and solid-sfc/runtime.`,
    );
  }
  return module;
}

const root = document.getElementById('root')!;
let dispose: (() => void) | undefined;

function showError(error: unknown): void {
  const message = document.createElement('pre');
  message.className = 'error';
  message.textContent = error instanceof Error ? error.message : String(error);
  root.replaceChildren(message);
}

function run({ code }: PreviewMessage): void {
  // Removing the last component also removes its stylesheet.
  dispose?.();
  dispose = undefined;
  root.replaceChildren();
  try {
    const exports: { default?: (props: object) => solid.Element } = {};
    // oxlint-disable-next-line typescript/no-implied-eval -- running the playground's code is the point.
    new Function('__import', '__exports', toFunctionBody(code))(importModule, exports);
    const Component = exports.default;
    if (!Component) {
      throw new Error('The component has no default export.');
    }
    dispose = web.render(() => web.createComponent(Component, {}), root);
  } catch (error) {
    showError(error);
  }
}

addEventListener('message', (event: MessageEvent<PreviewMessage>) => {
  if (event.origin === location.origin && event.source === parent) {
    run(event.data);
  }
});

addEventListener('error', (event) => showError(event.error ?? event.message));
addEventListener('unhandledrejection', (event) => showError(event.reason));

// Tells the playground that the frame can take a component.
parent.postMessage({ ready: true }, location.origin);
