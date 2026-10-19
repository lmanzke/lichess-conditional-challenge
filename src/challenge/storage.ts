import { Effect } from 'effect';
import type { Rule } from '@/challenge/types';

export const RULES_KEY = 'lichessTeamRules';

export const getLichessPrefs: Effect.Effect<Rule, Error> = Effect.gen(function* () {
  const stored = yield* Effect.tryPromise({
    try: () => chrome.storage.sync.get(RULES_KEY),
    catch: cause => new Error(`could not read prefs: ${String(cause)}`),
  });
  const raw = stored[RULES_KEY];

  if (typeof raw !== 'string' || raw === '') {
    return yield* Effect.fail(new Error('no prefs found'));
  }

  return yield* Effect.try({
    try: () => JSON.parse(raw) as Rule,
    catch: cause => new Error(`invalid prefs: ${String(cause)}`),
  });
});
