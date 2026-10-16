import { render } from '@solidjs/web';
import App from './App.solid';
import './theme.css';

const app = document.getElementById('app');

if (app) {
  render(() => App(), app);
}
