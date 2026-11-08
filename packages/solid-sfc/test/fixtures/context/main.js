import { renderToString } from '@solidjs/web';
import App from './App.solid';

export const html = renderToString(() => App({}));
