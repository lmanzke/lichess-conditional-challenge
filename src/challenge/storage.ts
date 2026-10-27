import { Effect } from 'effect';
import { getActiveProfile, loadProfiles } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';

/** The rules of the active profile. */
export const getLichessPrefs: Effect.Effect<Rule, Error> = Effect.suspend(() => loadProfiles(chrome.storage.sync)).pipe(Effect.map(state => getActiveProfile(state).rules));
