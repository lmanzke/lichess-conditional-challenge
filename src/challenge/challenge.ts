import { Effect, ManagedRuntime } from 'effect';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from '@/i18n';
import { Lichess } from '@/challenge/lichess-api';
import { keepAttached, waitFor } from '@/challenge/mount';

const CHALLENGES_CONTAINER_ID = 'challenge-app';
const CHALLENGE_MENU_TOGGLE_ID = 'challenge-toggle';

// The page can take a while on slow connections, rendering the menu itself is quick once the button works.
const PAGE_LOAD_TIMEOUT_MS = 30_000;
const RENDER_TIMEOUT_MS = 3_000;
const RENDER_ATTEMPTS = 5;

const runtime = ManagedRuntime.make(Lichess.layerFetch(location.origin));

const isRendered = (container: HTMLElement | null) => (container?.className.includes('rendered') ? container : null);
const findRenderedContainer = () => isRendered(document.getElementById(CHALLENGES_CONTAINER_ID));

/** Lichess renders the challenge popover lazily, so toggling the menu forces it into the DOM. Toggling again on a retry in case the page was not ready yet. */
const renderContainer = Effect.gen(function* () {
  const button = yield* waitFor('challenge menu button', () => document.getElementById(CHALLENGE_MENU_TOGGLE_ID), PAGE_LOAD_TIMEOUT_MS);
  button.click();
  button.click();
  return yield* waitFor('challenge menu', findRenderedContainer, RENDER_TIMEOUT_MS);
}).pipe(Effect.retry({ times: RENDER_ATTEMPTS - 1 }));

const mountApp = Effect.gen(function* () {
  const container = yield* renderContainer;

  const root = document.createElement('div');
  container.prepend(root);
  createApp(App, { container, runEffect: <A>(effect: Effect.Effect<A, Error, Lichess>) => runtime.runPromise(effect) })
    .use(i18n)
    .mount(root);
  keepAttached(root, findRenderedContainer);
});

void mountApp.pipe(
  Effect.catch(error => Effect.sync(() => console.error('Could not find the target element', error))),
  Effect.runPromise
);
