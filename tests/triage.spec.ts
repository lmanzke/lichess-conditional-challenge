import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import type { Lichess } from '@/challenge/lichess-api';
import { judge, triageAll, triageUntilMatch } from '@/challenge/triage';
import { DeclineReason, type Challenge, type Spec } from '@/challenge/types';
import { lichessLayer, makeChallenge } from './helpers';

const challenge = (id: string, rating: number): Challenge => makeChallenge({ id, challenger: { id, rating } });

// 2000 and more matches, below 1000 fails silently, everything else fails loudly.
const spec: Spec = c =>
  Effect.succeed(c.challenger.rating >= 2000 ? { isSatisfied: true } : { isSatisfied: false, silent: c.challenger.rating < 1000, reason: DeclineReason.RULE_FAILED });

const run = <A>(effect: Effect.Effect<A, Error, Lichess>) => Effect.runPromise(effect.pipe(Effect.provide(lichessLayer())));

describe('judge', () => {
  it('should match, decline loud failures with their reason and skip silent ones', async () => {
    await expect(run(judge(spec, challenge('a', 2200)))).resolves.toEqual({ kind: 'match' });
    await expect(run(judge(spec, challenge('b', 1500)))).resolves.toEqual({ kind: 'declined', reason: DeclineReason.RULE_FAILED });
    await expect(run(judge(spec, challenge('c', 500)))).resolves.toEqual({ kind: 'skipped' });
  });
});

describe('triageUntilMatch', () => {
  it('should stop at the first match and decline only the loud failures before it', async () => {
    const judged = vi.fn(spec);
    const challenges = [challenge('silent', 500), challenge('low', 1500), challenge('match', 2200), challenge('later', 1200)];

    const result = await run(triageUntilMatch(judged, challenges));

    expect(result.match?.id).toBe('match');
    expect(result.declined.map(({ challenge }) => challenge.id)).toEqual(['low']);
    expect(judged).toHaveBeenCalledTimes(3);
  });

  it('should return no match and all loud failures if nothing matches', async () => {
    const result = await run(triageUntilMatch(spec, [challenge('low', 1500), challenge('silent', 500), challenge('lower', 1100)]));

    expect(result.match).toBeUndefined();
    expect(result.declined.map(({ challenge }) => challenge.id)).toEqual(['low', 'lower']);
  });

  it('should handle an empty list', async () => {
    await expect(run(triageUntilMatch(spec, []))).resolves.toEqual({ declined: [] });
  });
});

describe('triageAll', () => {
  it('should return the loud failures of every challenge, in order, and leave matches and silent failures alone', async () => {
    const declined = await run(triageAll(spec, [challenge('low', 1500), challenge('match', 2200), challenge('silent', 500), challenge('lower', 1100)]));

    expect(declined.map(({ challenge, reason }) => [challenge.id, reason])).toEqual([
      ['low', DeclineReason.RULE_FAILED],
      ['lower', DeclineReason.RULE_FAILED],
    ]);
  });
});
