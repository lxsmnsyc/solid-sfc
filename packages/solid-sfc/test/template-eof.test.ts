import { parseSync } from 'oxc-parser';
import { describe, expect, it } from 'vitest';
import { compile } from '../src/index.ts';

const script = `<script>
  import type { Component } from 'solid-js';

  const { as = 'h2', icon } = $props<{ as?: string; icon: Component<{ size: number }> }>();
</script>

`;

describe('markup at the end of the file without a newline', () => {
  it.each([
    ['dynamic tag', '<{as} class="title">\n  <{icon} size=16 />\n  Hello\n</>'],
    ['self-closing dynamic tag', '<{icon} size=16 />'],
    ['plain element', '<h2 class="title">\n  Hello\n</h2>'],
    ['component', '<Icon size=16>\n  Hello\n</Icon>'],
  ])('compiles a %s to valid TSX', (_name, markup) => {
    const source = `${script}${markup}`;
    expect(source.endsWith('\n')).toBe(false);
    const { code } = compile(source);
    expect(parseSync('a.tsx', code).errors).toEqual([]);
  });
});
