import { render } from '@solidjs/web';
import App from './App.solid';
import './theme.css';

// The theme toggle in the header saves a choice. Without one, the site is dark.
function readTheme(): string {
  try {
    return localStorage.getItem('theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

document.documentElement.dataset.theme = readTheme();

const app = document.getElementById('app');

if (app) {
  render(() => App(), app);
}
