/**
 * The attribute that names the stylesheet of a component, as in
 * solid-styled. Sheets that the server rendered keep it, so the client
 * does not add them again.
 */
export const SHEET_ATTRIBUTE = 's:id';

// Browsers hide the `nonce` attribute once the element is in the document,
// so the property is read first.
function readNonce(node: Element): string | undefined {
  return (node as HTMLElement).nonce || node.getAttribute('nonce') || undefined;
}

/**
 * Finds the CSP nonce for new stylesheets: the nonce of a sheet that the
 * server rendered, or of a `<meta property="csp-nonce">`, which Vite also
 * reads for its own styles (`html.cspNonce`).
 */
export function findNonce(root: ParentNode): string | undefined {
  for (const node of root.querySelectorAll('style[s\\:id]')) {
    const nonce = readNonce(node);
    if (nonce) {
      return nonce;
    }
  }
  const meta = root.querySelector('meta[property="csp-nonce"]');
  return meta ? readNonce(meta) : undefined;
}
