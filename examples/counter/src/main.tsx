import { render } from '@solidjs/web';
import Root from './Root.solid';

const app = document.getElementById('app');

if (app) {
  render(() => <Root />, app);
}
