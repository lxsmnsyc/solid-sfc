declare module '*.md' {
  import type { Page } from '../plugins/markdown.ts';

  const page: Page;
  export default page;
}
