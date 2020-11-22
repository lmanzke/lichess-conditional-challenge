import { Rule } from '@/challenge/lichess';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const chrome: { storage: any };

export const getPromisedStorageKeys = (keys: string[]): Promise<{ [key: string]: string }> => {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
};

export const getLichessPrefs = (): Promise<Rule> =>
  new Promise((resolve, reject) => {
    getPromisedStorageKeys(['lichessTeamRules']).then(result => {
      if (result.lichessTeamRules) {
        resolve(JSON.parse(result.lichessTeamRules));
      } else {
        reject(new Error('no prefs found'));
      }
    });
  });
