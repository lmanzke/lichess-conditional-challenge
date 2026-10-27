import { Effect, Layer } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import type { StorageArea } from '@/challenge/profiles';
import type { Challenge, Spec } from '@/challenge/types';

export const makeChallenge = (overrides: Partial<Challenge> = {}): Challenge => ({
  id: 'OheaU77B',
  userLink: '/@/user-1',
  username: 'user-1',
  color: 'random',
  challenger: { rating: 1600, id: 'user-1' },
  rated: false,
  timeControl: { type: 'clock', limit: 300, increment: 3 },
  variant: { key: 'standard' },
  accept: () => {},
  decline: () => {},
  ...overrides,
});

const failing = (name: string) => () => Effect.die(`unexpected call to ${name}`);

export const lichessLayer = (overrides: Partial<Lichess['Service']> = {}) =>
  Layer.succeed(
    Lichess,
    Lichess.of({
      teamsOf: failing('teamsOf'),
      currentUserId: Effect.die('unexpected call to currentUserId'),
      crosstable: failing('crosstable'),
      incomingChallenges: Effect.die('unexpected call to incomingChallenges'),
      ...overrides,
    })
  );

export const runSpec = (spec: Spec, challenge: Challenge, overrides: Partial<Lichess['Service']> = {}) =>
  Effect.runPromise(spec(challenge).pipe(Effect.provide(lichessLayer(overrides))));

/** An in-memory stand-in for chrome.storage.sync. */
export const fakeStorage = (initial: Record<string, unknown> = {}): StorageArea & { data: Record<string, unknown> } => {
  const data = structuredClone(initial);
  const keysOf = (keys?: string | string[] | null) => (keys == null ? Object.keys(data) : [keys].flat());
  return {
    data,
    get: async keys =>
      Object.fromEntries(
        keysOf(keys)
          .filter(key => key in data)
          .map(key => [key, structuredClone(data[key])])
      ),
    set: async items => void Object.assign(data, structuredClone(items)),
    remove: async keys => void keysOf(keys).forEach(key => delete data[key]),
  };
};
