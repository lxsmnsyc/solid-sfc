import type { JSX } from '@solidjs/web';
import { isServer, useHead } from '@solidjs/web';
import { createMemo, merge, onCleanup, untrack } from 'solid-js';
import type { Accessor, Element } from 'solid-js';
import { SHEET_ATTRIBUTE, findNonce } from './nonce.ts';

type Style = JSX.CSSProperties | string | null | undefined;

/** Adds the CSS variables of a component's styles to a `style` value. */
export function mergeStyle(style: Style, variables: JSX.CSSProperties): Style {
  if (typeof style !== 'string') {
    return { ...style, ...variables };
  }
  let result = style;
  for (const [name, value] of Object.entries(variables)) {
    if (value != null) {
      result += `;${name}:${value}`;
    }
  }
  return result;
}

/**
 * Gives the `style` of a spread source the CSS variables of a component's
 * styles. `{...props}` on a scoped element becomes
 * `{...spreadStyle(props, variables)}`. A source without a `style` key is
 * returned as it is, so the keys of the spread do not change.
 */
export function spreadStyle<T>(source: T, variables: () => JSX.CSSProperties): T {
  // The key is checked once. A source that gains a `style` key later sets
  // that style without the variables.
  if (source == null || typeof source !== 'object' || !('style' in source)) {
    return source;
  }
  const styled = source as T & { style: Style };
  return merge(styled, {
    get style() {
      return mergeStyle(styled.style, variables());
    },
  }) as T;
}

/**
 * Renders `render` again whenever `source` changes. Used by `#key`.
 * Equal values do not render again.
 */
export function key<T>(source: () => T, render: () => Element): Accessor<Element> {
  const value = createMemo(source);
  return createMemo(() => {
    value();
    return untrack(render);
  });
}

type Listener<E> = ((event: E) => void) | null | undefined | false;

interface EventMaps {
  window: WindowEventMap;
  document: DocumentEventMap;
}

/**
 * Adds an event listener to `window` or `document` until the current owner
 * is removed. Used by `<solid:window>` and `<solid:document>`.
 */
// One signature instead of overloads, so TypeScript reports a wrong event
// name or handler on that argument, not on the call.
export function listen<T extends keyof EventMaps, K extends keyof EventMaps[T]>(
  target: T,
  type: K,
  listener: Listener<EventMaps[T][K]>,
): undefined {
  // There is no window on the server.
  if (!listener || typeof window === 'undefined') {
    return undefined;
  }
  const element = target === 'window' ? window : document;
  const handler = listener as (event: Event) => void;
  element.addEventListener(type as string, handler);
  onCleanup(() => element.removeEventListener(type as string, handler));
  return undefined;
}

/** The CSP nonce of new stylesheets, once found. */
let nonce: string | undefined;

/** The sheets in the document, and how many components use each one. */
const sheets = new Map<string, { node: HTMLStyleElement; count: number }>();

function findSheet(id: string): HTMLStyleElement | undefined {
  for (const node of document.head.querySelectorAll('style')) {
    if (node.getAttribute(SHEET_ATTRIBUTE) === id) {
      return node;
    }
  }
  return undefined;
}

/**
 * Adds the stylesheet of a component while an instance of it is rendered.
 * Used by `<style>` blocks. On the client, the first instance adds a
 * `<style>` to the head and the last one to be removed removes it. On the
 * server, the sheet goes into the head of the document once.
 */
export function useStyle(id: string, sheet: string): void {
  if (isServer) {
    useHead({
      tag: 'style',
      key: id,
      props: { [SHEET_ATTRIBUTE]: id, children: sheet },
    });
    return;
  }
  let entry = sheets.get(id);
  if (entry) {
    entry.count++;
    // A new version of the file, while the dev server replaces modules.
    if (entry.node.textContent !== sheet) {
      entry.node.textContent = sheet;
    }
  } else {
    // Read before a server rendered sheet can be removed.
    nonce ??= findNonce(document);
    let node = findSheet(id);
    if (!node) {
      node = document.createElement('style');
      node.setAttribute(SHEET_ATTRIBUTE, id);
      if (nonce) {
        node.setAttribute('nonce', nonce);
      }
      node.textContent = sheet;
      document.head.appendChild(node);
    } else if (node.textContent !== sheet) {
      node.textContent = sheet;
    }
    entry = { node, count: 1 };
    sheets.set(id, entry);
  }
  const current = entry;
  onCleanup(() => {
    current.count--;
    if (current.count === 0 && sheets.get(id) === current) {
      sheets.delete(id);
      current.node.remove();
    }
  });
}
