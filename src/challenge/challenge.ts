import { createApp } from 'vue';
import App from './App.vue';
import store from '../store';
import { getDependencyContainer } from '@/challenge/dependencies';

declare const global: { browser: unknown };

global.browser = require('webextension-polyfill');

/* eslint-disable no-new */

const CHALLENGES_CONTAINER_ID = 'challenge-app';
const CHALLENGE_MENU_TOGGLE_ID = 'challenge-toggle';

function init(container: HTMLElement) {
  const div = document.createElement('div');
  container.prepend(div);

  return div;
}
function loadContainer() {
  const e = document.getElementById(CHALLENGE_MENU_TOGGLE_ID) as HTMLButtonElement;
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
  const renderedIndex = container?.className?.indexOf('rendered') ?? -1;
  if (renderedIndex > 0 && container !== null) {
    const element = init(container);
    const dependencies = getDependencyContainer();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    createApp(App, { container, dependencies })
      .use(store)
      .mount(element);
  } else {
    loadContainer();
    setTimeout(initWhenContainerLoaded, 100);
  }
}

initWhenContainerLoaded();
