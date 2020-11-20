import './bootstrap.scss';
import { createApp } from 'vue';
import App from './App';



global.browser = require('webextension-polyfill');

/* eslint-disable no-new */
createApp(App).mount('#app');
