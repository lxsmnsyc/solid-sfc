import type { Page } from '../plugins/markdown.ts';

const modules = import.meta.glob<Page>('../docs/*.md', { eager: true, import: 'default' });

/** The pages of the documentation, by their path after `/docs/`. */
export const pages: Record<string, Page> = {};
for (const [file, page] of Object.entries(modules)) {
  const name = /([\w-]+)\.md$/.exec(file)![1]!;
  pages[name === 'README' ? '' : name] = page;
}

/** The pages in reading order, for the sidebar. */
export const order = [
  '',
  'getting-started',
  'components',
  'markup',
  'control-flow',
  'reactivity',
  'styles',
  'tooling',
  'migration',
].map((slug) => ({ slug, title: slug === '' ? 'Introduction' : (pages[slug]?.title ?? slug) }));
