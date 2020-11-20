export const getPromisedStorageKeys = keys => {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
};

export const getLichessPrefs = () =>
  new Promise((resolve, reject) => {
    getPromisedStorageKeys(['lichessTeamRules']).then(result => {
      if (result.lichessTeamRules) {
        resolve(JSON.parse(result.lichessTeamRules));
      } else {
        reject(new Error('no prefs found'));
      }
    });
  });
