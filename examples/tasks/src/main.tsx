import { render } from '@solidjs/web';
import App from './App.solid';

const app = document.getElementById('app');

if (app) {
  render(() => <App />, app);
}
