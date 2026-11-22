import { Effect } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptMatchingChallenge, declineUnmatchingChallenges } from '@/challenge/actions';
import type { ChallengeInbox } from '@/challenge/inbox';
import type { Lichess } from '@/challenge/lichess-api';
import { newProfile, saveProfiles } from '@/challenge/profiles';
import type { RuleNode } from '@/challenge/types';
import { fakeInbox, fakeStorage, lichessLayer, makeChallenge } from './helpers';

// Accepts challengers with a rating of 2000 or more. The rule below is silent for challengers under 1000.
const ratingAtLeast = (rating: number): RuleNode => ({ combinator: 'AND', children: [{ field: 'rating', relation: 'greater_or_equal', value: rating, silent: false }] });
const silentBelow: RuleNode = {
  combinator: 'AND',
  children: [
    { field: 'rating', relation: 'greater_or_equal', value: 1000, silent: true },
    { field: 'rating', relation: 'greater_or_equal', value: 2000, silent: false },
  ],
};

const challenge = (id: string, rating: number) => makeChallenge({ id, challenger: { id, rating } });

const withRules = async (ruleTree: RuleNode) => {
  const storage = fakeStorage();
  vi.stubGlobal('chrome', { storage: { sync: storage } });
  await Effect.runPromise(saveProfiles(storage, { activeId: 'p', profiles: [{ ...newProfile('P', ruleTree), id: 'p' }] }));
};

const runWith = <A>(effect: Effect.Effect<A, Error, Lichess | ChallengeInbox>, inbox: ReturnType<typeof fakeInbox>) =>
  Effect.runPromise(effect.pipe(Effect.provide(inbox.layer), Effect.provide(lichessLayer())));

beforeEach(() => withRules(ratingAtLeast(2000)));
afterEach(() => vi.unstubAllGlobals());

describe('acceptMatchingChallenge', () => {
  it('should accept the matching challenge', async () => {
    const inbox = fakeInbox([challenge('match', 2200), challenge('other', 2500)]);

    await expect(runWith(acceptMatchingChallenge, inbox)).resolves.toEqual({ kind: 'accepted' });
    expect(inbox.accepted).toHaveLength(1);
    expect(['match', 'other']).toContain(inbox.accepted[0]);
  });

  it('should decline every loud failure and fail if nothing matches', async () => {
    const inbox = fakeInbox([challenge('a', 1500), challenge('b', 1200)]);

    await expect(runWith(acceptMatchingChallenge, inbox)).rejects.toThrow('No matching challenge');
    expect(inbox.declined.map(([id]) => id).sort()).toEqual(['a', 'b']);
    expect(inbox.accepted).toEqual([]);
  });

  it('should leave silent failures alone', async () => {
    await withRules(silentBelow);
    const inbox = fakeInbox([challenge('silent', 500), challenge('match', 2200)]);

    await runWith(acceptMatchingChallenge, inbox);

    expect(inbox.accepted).toEqual(['match']);
    expect(inbox.declined).toEqual([]);
  });
});

describe('declineUnmatchingChallenges', () => {
  it('should decline the loud failures and count them', async () => {
    await withRules(silentBelow);
    const inbox = fakeInbox([challenge('silent', 500), challenge('low', 1500), challenge('match', 2200)]);

    await expect(runWith(declineUnmatchingChallenges, inbox)).resolves.toEqual({ kind: 'declined', count: 1 });
    expect(inbox.declined.map(([id]) => id)).toEqual(['low']);
    expect(inbox.accepted).toEqual([]);
  });
});
