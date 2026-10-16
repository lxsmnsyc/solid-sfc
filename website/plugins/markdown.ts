/**
 * Turns the Markdown files of the documentation into modules that export
 * their HTML, title and headings. Code blocks are highlighted with
 * twinkleplop, and `html` blocks, which hold `.solid` code, use the `.solid`
 * language of the site.
 */
import { language as bash } from '@twinkleplop/bash';
import { language as css } from '@twinkleplop/css';
import { language as json } from '@twinkleplop/json';
import twinkleplop from '@twinkleplop/markdown-it';
import { language as tsx } from '@twinkleplop/tsx';
import { language as typescript } from '@twinkleplop/typescript';
import MarkdownIt from 'markdown-it';
import type { Plugin } from 'vite';
import { language as solid } from '../src/highlight/solid.ts';

const REPOSITORY = 'https://github.com/lxsmnsyc/solid-sfc';

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export interface Page {
  title: string;
  html: string;
  headings: Heading[];
}

const LANGUAGES = {
  solid: solid(),
  // `.solid` code is written in `html` blocks, so GitHub highlights it too.
  html: 'solid',
  ts: typescript(),
  tsx: tsx(),
  css: css(),
  // SCSS and Less examples are close enough to CSS.
  scss: 'css',
  less: 'css',
  bash: bash(),
  json: json(),
};

/** A heading id as GitHub makes it, so links between pages keep working. */
export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s/g, '-');
}

/**
 * Points links between documents at the pages of the site, and links to the
 * rest of the repository at GitHub.
 */
function rewriteLink(href: string, base: string): string {
  const page = /^\.\/([\w-]+)\.md(#.*)?$/.exec(href);
  if (page) {
    const name = page[1] === 'README' ? '' : page[1]!;
    return `${base}docs/${name}${page[2] ?? ''}`;
  }
  if (href.startsWith('../')) {
    return `${REPOSITORY}/tree/main/${href.replace(/^(\.\.\/)+/, '')}`;
  }
  return href;
}

function createRenderer(base: string): MarkdownIt {
  const parser = new MarkdownIt({ html: false, linkify: false });
  parser.use(twinkleplop, { languages: LANGUAGES, on_unknown_language: 'plain' });
  parser.renderer.rules.link_open = (tokens, index, options, _env, self) => {
    const token = tokens[index]!;
    const href = token.attrGet('href');
    if (href) {
      const rewritten = rewriteLink(href, base);
      token.attrSet('href', rewritten);
      if (rewritten.startsWith('http')) {
        token.attrSet('target', '_blank');
        token.attrSet('rel', 'noreferrer');
      }
    }
    return self.renderToken(tokens, index, options);
  };
  parser.renderer.rules.heading_open = (
    tokens,
    index,
    options,
    env: { headings: Heading[] },
    self,
  ) => {
    const token = tokens[index]!;
    const text = tokens[index + 1]?.content ?? '';
    const id = slug(text);
    token.attrSet('id', id);
    env.headings.push({ level: Number(token.tag.slice(1)), text: text.replaceAll('`', ''), id });
    return self.renderToken(tokens, index, options);
  };
  return parser;
}

/** Compiles `.md` imports into pages. */
export default function markdown(): Plugin {
  let base = '/';
  return {
    name: 'website:markdown',
    configResolved(config) {
      base = config.base;
    },
    transform(code, id) {
      if (!id.endsWith('.md')) {
        return null;
      }
      const env = { headings: [] as Heading[] };
      const html = createRenderer(base).render(code, env);
      const page: Page = {
        title: env.headings.find((heading) => heading.level === 1)?.text ?? '',
        html,
        headings: env.headings,
      };
      return { code: `export default ${JSON.stringify(page)};`, map: null };
    },
  };
}
