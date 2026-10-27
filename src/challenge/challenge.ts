import { Effect, ManagedRuntime, Schedule } from 'effect';
import { createApp } from 'vue';
import App from './App.vue';
import { i18n } from '@/i18n';
import { Lichess } from '@/challenge/lichess-api';

const CHALLENGES_CONTAINER_ID = 'challenge-app';
const CHALLENGE_MENU_TOGGLE_ID = 'challenge-toggle';

const runtime = ManagedRuntime.make(Lichess.layerFetch(location.origin));

/** Lichess renders the challenge popover lazily, so toggling the menu forces it into the DOM. */
const mountApp = Effect.gen(function* () {
  const button = document.getElementById(CHALLENGE_MENU_TOGGLE_ID);
  if (!button) {
    return yield* Effect.fail(new Error('no button'));
  }

  button.click();
  button.click();

  const container = document.getElementById(CHALLENGES_CONTAINER_ID);
  if (!container?.className.includes('rendered')) {
    return yield* Effect.fail(new Error('no container'));
  }

  const root = document.createElement('div');
  container.prepend(root);
  createApp(App, { container, runEffect: <A>(effect: Effect.Effect<A, Error, Lichess>) => runtime.runPromise(effect) })
    .use(i18n)
    .mount(root);
});

void mountApp.pipe(
  Effect.retry({ times: 5, schedule: Schedule.spaced(100) }),
  Effect.match({
    onFailure: error => console.error('Could not find the target element', error),
    onSuccess: () => console.log('Element mounted'),
  }),
  Effect.runPromise
);
