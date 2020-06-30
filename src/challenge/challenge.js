import Vue from 'vue';
import App from './App';
import store from '../store';

global.browser = require('webextension-polyfill');
Vue.prototype.$browser = global.browser;

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
    console.error('lichessARC could not find challenge menu toggle (element with id ' + CHALLENGE_MENU_TOGGLE_ID + ')');
  }
  e.click(); // open challanges menu
  e.click(); // close challanges menu
}
function initWhenContainerLoaded() {
  var container = document.getElementById(CHALLENGES_CONTAINER_ID);
  if (!container) {
    console.error('lichessARC could not find challenges container (element with id ' + CHALLENGES_CONTAINER_ID + ')');
  }
  if (container.className.indexOf('rendered') > 0) {
    const element = init(container);
    new Vue({
      el: element,
      store,
      render: h => h(App, { props: { container } }),
    });
  } else {
    loadContainer();
    setTimeout(initWhenContainerLoaded, 100);
  }
}

initWhenContainerLoaded();
