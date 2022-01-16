import { render } from 'solid-js/web';
import Root from './Root.solid';

import './style.css';

const app = document.getElementById('app');

if (app) {
  render(() => <Root />, app);
}
