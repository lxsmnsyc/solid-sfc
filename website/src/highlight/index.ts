import { language as css } from '@twinkleplop/css';
import { language as tsx } from '@twinkleplop/tsx';
import { language as solid } from './solid.ts';

const languages = { solid: solid(), tsx: tsx(), css: css() };

/** Highlights code as HTML, a `pre.twinkleplop` element. */
export function highlight(code: string, lang: keyof typeof languages): string {
  return languages[lang](code);
}
