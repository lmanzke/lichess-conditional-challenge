import { Effect } from 'effect';
import { chromeProfileStore } from '@/challenge/profile-store';
import type { RuleNode } from '@/challenge/types';

/** The rule tree of the active profile. */
export const getLichessPrefs: Effect.Effect<RuleNode, Error> = Effect.suspend(() => chromeProfileStore().activeRuleTree);
