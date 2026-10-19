/**
 * Turns the TSX of the compiler into JavaScript in the browser: Oxc removes
 * the types and Solid's compiler compiles the JSX. Both are WebAssembly, so
 * the playground loads this module when the preview opens.
 */
import { transform as compileJSX } from '@solidjs/compiler-wasm32-wasi';
import { transformSync } from 'oxc-transform';

export function buildPreview(tsx: string): string {
  const plain = transformSync('Playground.tsx', tsx, { jsx: 'preserve' });
  const error = plain.errors[0];
  if (error) {
    throw new Error(error.message);
  }
  return compileJSX(plain.code, { filename: 'Playground.jsx', generate: 'dom' }).code;
}
