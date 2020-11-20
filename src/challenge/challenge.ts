import { createApp } from 'vue';
import App from './App.vue';
import store from '../store';

declare const global: { browser: unknown };

global.browser = require('webextension-polyfill');

/* eslint-disable no-new */

const CHALLENGES_CONTAINER_ID = 'challenge-app';
const CHALLENGE_MENU_TOGGLE_ID = 'challenge-toggle';

function init(container) {
  const div = document.createElement('div');
  container.prepend(div);

  return div;
}
function loadContainer() {
  const e = document.getElementById(CHALLENGE_MENU_TOGGLE_ID);
  if (!e) {
    console.error('Could not find challenge menu toggle (element with id ' + CHALLENGE_MENU_TOGGLE_ID + ')');
  }
  e.click(); // open challanges menu
  e.click(); // close challanges menu
}
function initWhenContainerLoaded() {
  const container = document.getElementById(CHALLENGES_CONTAINER_ID);
  if (!container) {
    console.error('Could not find challenges container (element with id ' + CHALLENGES_CONTAINER_ID + ')');
  }
  if (container?.className?.indexOf('rendered') > 0) {
    const element = init(container);
    createApp(App, { container, $browser: global.browser })
      .use(store)
      .mount(element);
  } else {
    loadContainer();
    setTimeout(initWhenContainerLoaded, 100);
  }
}

initWhenContainerLoaded();
