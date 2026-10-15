import type { JSX } from '@solidjs/web';
import { createMemo, onCleanup, untrack } from 'solid-js';
import type { Accessor, Element } from 'solid-js';

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
