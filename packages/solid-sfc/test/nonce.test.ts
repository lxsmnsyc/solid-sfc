import type * as Web from '@solidjs/web';
import { createRoot } from 'solid-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findNonce } from '../src/nonce.ts';

vi.mock('@solidjs/web', async (importOriginal) => ({
  ...(await importOriginal<typeof Web>()),
  isServer: false,
}));

/** A small stand-in for the DOM elements that the runtime touches. */
class FakeElement {
  attributes = new Map<string, string>();
  children: FakeElement[] = [];
  parent: FakeElement | undefined;
  textContent = '';
  // Browsers hide the attribute and keep the value in the property.
  nonce = '';

  constructor(readonly tagName: string) {}

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  appendChild(child: FakeElement): void {
    child.parent = this;
    this.children.push(child);
  }

  remove(): void {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((child) => child !== this);
    }
  }

  querySelectorAll(selector: string): FakeElement[] {
    if (selector === 'style') {
      return this.children.filter((child) => child.tagName === 'style');
    }
    if (selector === 'style[s\\:id]') {
      return this.children.filter(
        (child) => child.tagName === 'style' && child.attributes.has('s:id'),
      );
    }
    throw new Error(`Unexpected selector ${selector}`);
  }

  querySelector(selector: string): FakeElement | null {
    if (selector === 'meta[property="csp-nonce"]') {
      return (
        this.children.find(
          (child) => child.tagName === 'meta' && child.getAttribute('property') === 'csp-nonce',
        ) ?? null
      );
    }
    throw new Error(`Unexpected selector ${selector}`);
  }
}

function element(tag: string, attributes: Record<string, string> = {}, nonce = ''): FakeElement {
  const node = new FakeElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  node.nonce = nonce;
  return node;
}

let head: FakeElement;

beforeEach(() => {
  vi.resetModules();
  head = new FakeElement('head');
  vi.stubGlobal('document', {
    head,
    createElement: (tag: string) => new FakeElement(tag),
    querySelectorAll: (selector: string) => head.querySelectorAll(selector),
    querySelector: (selector: string) => head.querySelector(selector),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('findNonce', () => {
  it('reads the nonce property of a server rendered sheet', () => {
    head.appendChild(element('style', { 's:id': 's-a' }, 'abc'));
    expect(findNonce(head as unknown as ParentNode)).toBe('abc');
  });

  it('reads the nonce attribute when the property is empty', () => {
    head.appendChild(element('style', { 's:id': 's-a', nonce: 'abc' }));
    expect(findNonce(head as unknown as ParentNode)).toBe('abc');
  });

  it('skips sheets that are not from solid-sfc', () => {
    head.appendChild(element('style', {}, 'other'));
    expect(findNonce(head as unknown as ParentNode)).toBe(undefined);
  });

  it('falls back to the csp-nonce meta tag', () => {
    head.appendChild(element('meta', { property: 'csp-nonce' }, 'meta'));
    expect(findNonce(head as unknown as ParentNode)).toBe('meta');
  });

  it('returns undefined without a nonce', () => {
    expect(findNonce(head as unknown as ParentNode)).toBe(undefined);
  });
});

/** Renders a component that uses the sheet `id`, with a fresh runtime module. */
async function mount(id: string): Promise<() => void> {
  const { useStyle } = await import('../src/runtime.ts');
  return createRoot((dispose) => {
    useStyle(id, 'p{color:red}');
    return dispose;
  });
}

describe('useStyle on the client', () => {
  it('gives new sheets the nonce of the server rendered sheets', async () => {
    head.appendChild(element('style', { 's:id': 's-server' }, 'abc'));
    await mount('s-new');
    const sheet = head.children.find((child) => child.getAttribute('s:id') === 's-new');
    expect(sheet?.getAttribute('nonce')).toBe('abc');
  });

  it('keeps the nonce after the server rendered sheet is removed', async () => {
    head.appendChild(element('style', { 's:id': 's-server' }, 'abc'));
    const dispose = await mount('s-server');
    dispose();
    expect(head.children).toEqual([]);
    await mount('s-new');
    expect(head.children[0]?.getAttribute('nonce')).toBe('abc');
  });

  it('uses the csp-nonce meta tag', async () => {
    head.appendChild(element('meta', { property: 'csp-nonce' }, 'meta'));
    await mount('s-new');
    const sheet = head.children.find((child) => child.tagName === 'style');
    expect(sheet?.getAttribute('nonce')).toBe('meta');
  });

  it('adds no nonce when the page has none', async () => {
    await mount('s-new');
    expect(head.children[0]?.getAttribute('nonce')).toBe(null);
  });
});
