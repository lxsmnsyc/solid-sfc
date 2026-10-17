/**
 * A small router on the History API. Links within the site change the path
 * without a page load.
 */
import { createSignal } from 'solid-js';

const base = import.meta.env.BASE_URL;

/** The path of the page within the site, such as `/docs/markup`. */
function currentPath(): string {
  const path = location.pathname.startsWith(base)
    ? `/${location.pathname.slice(base.length)}`
    : location.pathname;
  return path.length > 1 ? path.replace(/\/$/, '') : path;
}

const [path, setPath] = createSignal(currentPath());

export { path };

/** The URL of a page of the site, from its path. */
export function href(to: string): string {
  return base + to.replace(/^\//, '');
}

function scrollToHash(): void {
  const target = location.hash
    ? document.getElementById(decodeURIComponent(location.hash.slice(1)))
    : null;
  if (target) {
    target.scrollIntoView();
  } else {
    window.scrollTo(0, 0);
  }
}

export function navigate(url: string): void {
  const before = location.pathname;
  history.pushState(null, '', url);
  setPath(currentPath());
  // The new page renders first.
  requestAnimationFrame(() => {
    if (location.pathname !== before || location.hash) {
      scrollToHash();
    }
  });
}

addEventListener('popstate', () => setPath(currentPath()));

document.addEventListener('click', (event) => {
  const link = (event.target as Element | null)?.closest('a');
  if (
    !link ||
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    link.target ||
    link.origin !== location.origin ||
    !link.pathname.startsWith(base)
  ) {
    return;
  }
  event.preventDefault();
  navigate(link.pathname + link.search + link.hash);
});
