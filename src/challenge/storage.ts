import * as TE from 'fp-ts/TaskEither';
import * as T from 'fp-ts/Task';
import * as IOE from 'fp-ts/IOEither';
import { pipe } from 'fp-ts/function';
import { Rule } from '@/challenge/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: { storage: any };

const tryParse = <A>(str: string) =>
  IOE.tryCatch<Error, A>(
    () => JSON.parse(str),
    reason => reason as Error
  );

export const getPromisedStorageKeys = (keys: string[]): T.Task<{ [key: string]: string }> => () => {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
};

export const getLichessPrefs = pipe(
  getPromisedStorageKeys(['lichessTeamRules']),
  TE.fromTask,
  TE.chain(result => {
    if (result.lichessTeamRules) {
      return TE.fromIOEither(tryParse<Rule>(result.lichessTeamRules));
    } else {
      return TE.left(new Error('no prefs found'));
    }
  })
);
