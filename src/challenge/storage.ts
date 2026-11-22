import { Effect } from 'effect';
import { getActiveProfile, loadProfiles } from '@/challenge/profiles';
import type { RuleNode } from '@/challenge/types';

/** The rule tree of the active profile. */
export const getLichessPrefs: Effect.Effect<RuleNode, Error> = Effect.suspend(() => loadProfiles(chrome.storage.sync)).pipe(Effect.map(state => getActiveProfile(state).ruleTree));
