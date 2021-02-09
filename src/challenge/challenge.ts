import { createApp, ComponentPublicInstance } from 'vue';
import App from './App.vue';
import { getDependencyContainer } from '@/challenge/dependencies';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import * as IOE from 'fp-ts/IOEither';
import * as E from 'fp-ts/Either';
import * as IO from 'fp-ts/IO';
import { JpexInstance } from 'jpex';
import { flow, pipe } from 'fp-ts/function';
import { Store } from 'vuex';
import { ReaderTaskEither } from 'fp-ts/ReaderTaskEither';
import { wait3 } from '@/util/tagless';
import { State } from '@/store';

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
const initIO = (container: HTMLElement): IO.IO<HTMLElement> => () => init(container);

const getContainer = (document: Document) => E.fromNullable('no container')(document.getElementById(CHALLENGES_CONTAINER_ID));
const getButton = (document: Document) => E.fromNullable('no button')(document.getElementById(CHALLENGE_MENU_TOGGLE_ID) as HTMLButtonElement);
const getDocument: IOE.IOEither<string, Document> = () => E.fromNullable('no document')(document);

const guardContainerLoaded = flow(
  getContainer,
  E.bindTo('container'),
  E.bind('className', ({ container }) => E.fromNullable('no class')(container.className)),
  E.bind('renderedIndex', ({ className }) => E.of(className.indexOf('rendered'))),
  E.chain(({ renderedIndex, container }) => {
    if (renderedIndex > -1) {
      return E.right(container);
    }

    return E.left('no container');
  })
);

const executeAfter = wait3(RTE.readerTaskEither);

const mountContainer = (element: HTMLElement): ReaderTaskEither<JpexInstance, string, ComponentPublicInstance> => r =>
  TE.fromIO(
    pipe(
      initIO(element),
      IO.chain(rootElement => () => {
        const store = r.resolve<Store<State>>('store');
        return createApp(App, { container: element, dependencies: r })
          .use(store)
          .mount(rootElement);
      })
    )
  );

const mountWhenLoaded = flow(guardContainerLoaded, RTE.fromEither, RTE.chain(mountContainer));

const toggleAndLoadDocument = (document: Document) =>
  pipe(
    getButton(document),
    RTE.fromEither,
    RTE.chain(button =>
      RTE.rightTask(async () => {
        button.click();
        button.click();
      })
    ),
    RTE.chain(() => mountWhenLoaded(document))
  );

const toggleAndLoad = pipe(getDocument, RTE.fromIOEither, RTE.chain(toggleAndLoadDocument));

const tryLoad = (retryCount: number): RTE.ReaderTaskEither<JpexInstance, string, ComponentPublicInstance> =>
  retryCount > 0
    ? pipe(
        toggleAndLoad,
        RTE.fold(
          () => executeAfter(100)(tryLoad(retryCount - 1)),
          v => RTE.of<JpexInstance, string, ComponentPublicInstance>(v)
        )
      )
    : RTE.left('Could not find the target element');

const initializer = tryLoad(5)(getDependencyContainer());

initializer().then(E.fold(console.error, () => console.log('Element mounted')));
