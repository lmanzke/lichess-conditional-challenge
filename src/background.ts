// A click on the toolbar icon opens the options, which is where the profiles are managed.
chrome.action.onClicked.addListener(() => void chrome.runtime.openOptionsPage());
