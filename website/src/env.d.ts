declare module '*.md' {
  import type { Page } from '../plugins/markdown.ts';

  const page: Page;
  export default page;
}

// The WebAssembly build of `@solidjs/compiler`, which has no types of its own.
declare module '@solidjs/compiler-wasm32-wasi' {
  export function transform(
    code: string,
    options?: { filename?: string; generate?: 'dom' | 'ssr'; hydratable?: boolean; dev?: boolean },
  ): { code: string; map?: string | null };
}
