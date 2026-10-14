import type { JSX } from 'solid-js';

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
