import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { findMatchingChallenge } from '@/challenge/actions';
import { DeclineReason, type Spec } from '@/challenge/types';
import { lichessLayer, makeChallenge } from './helpers';

const find = (spec: Spec, challenges: ReturnType<typeof makeChallenge>[]) => Effect.runPromise(findMatchingChallenge(spec, challenges).pipe(Effect.provide(lichessLayer())));

describe('findMatchingChallenge', () => {
  const spec: Spec = challenge =>
    Effect.succeed(
      challenge.challenger.rating >= 2000 ? { isSatisfied: true } : { isSatisfied: false, silent: challenge.challenger.rating < 1000, reason: DeclineReason.RULE_FAILED }
    );

  it('should return the matching challenge and decline the non-silent ones it looked at', async () => {
    const decline = vi.fn();
    const silentDecline = vi.fn();
    const match = makeChallenge({ id: 'match', challenger: { id: 'a', rating: 2200 } });
    const challenges = [
      match,
      makeChallenge({ id: 'low', challenger: { id: 'b', rating: 1500 }, decline }),
      makeChallenge({ id: 'silent', challenger: { id: 'c', rating: 500 }, decline: silentDecline }),
    ];

    await expect(find(spec, challenges)).resolves.toBe(match);
    expect(silentDecline).not.toHaveBeenCalled();
  });

  it('should fail without matching challenges', async () => {
    await expect(find(spec, [makeChallenge({ challenger: { id: 'b', rating: 1500 } })])).rejects.toThrow('No matching challenge');
    await expect(find(spec, [])).rejects.toThrow('No matching challenge');
  });
});
