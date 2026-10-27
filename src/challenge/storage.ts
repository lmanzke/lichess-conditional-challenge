import { Effect } from 'effect';
import { getActiveProfile, loadProfiles } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';

/** The rules of the active profile. */
export const getLichessPrefs: Effect.Effect<Rule, Error> = Effect.tryPromise({
  try: async () => getActiveProfile(await loadProfiles(chrome.storage.sync)).rules,
  catch: cause => new Error(`could not read prefs: ${String(cause)}`),
});
