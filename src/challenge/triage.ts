import { Effect } from 'effect';
import type { Lichess } from '@/challenge/lichess-api';
import type { Challenge, DeclineReason, Spec } from '@/challenge/types';

/** What to do with a challenge: accept it, decline it, or leave it alone. */
export type Verdict = { readonly kind: 'match' } | { readonly kind: 'declined'; readonly reason: DeclineReason } | { readonly kind: 'skipped' };

export interface Declination {
  readonly challenge: Challenge;
  readonly reason: DeclineReason;
}

/** Judges a challenge. This is the only place that knows a silent failure is skipped instead of declined. */
export const judge = (spec: Spec, challenge: Challenge): Effect.Effect<Verdict, Error, Lichess> =>
  Effect.map(spec(challenge), (result): Verdict => {
    if (result.isSatisfied) return { kind: 'match' };
    return result.silent ? { kind: 'skipped' } : { kind: 'declined', reason: result.reason };
  });

/**
 * Judges the challenges in the given order until one matches, so the lichess requests of the rest are saved.
 * Returns the match (if any) and the challenges to decline that were seen before it. Nothing is accepted or declined here.
 */
export const triageUntilMatch = (spec: Spec, challenges: ReadonlyArray<Challenge>): Effect.Effect<{ match?: Challenge; declined: Declination[] }, Error, Lichess> =>
  Effect.gen(function* () {
    const declined: Declination[] = [];

    for (const challenge of challenges) {
      const verdict = yield* judge(spec, challenge);

      if (verdict.kind === 'match') {
        return { match: challenge, declined };
      }
      if (verdict.kind === 'declined') {
        declined.push({ challenge, reason: verdict.reason });
      }
    }

    return { declined };
  });

/** Judges all challenges and returns the ones to decline. Nothing is declined here. */
export const triageAll = (spec: Spec, challenges: ReadonlyArray<Challenge>): Effect.Effect<Declination[], Error, Lichess> =>
  Effect.forEach(challenges, challenge => Effect.map(judge(spec, challenge), verdict => ({ challenge, verdict })), { concurrency: 4 }).pipe(
    Effect.map(judged => judged.flatMap(({ challenge, verdict }): Declination[] => (verdict.kind === 'declined' ? [{ challenge, reason: verdict.reason }] : [])))
  );
