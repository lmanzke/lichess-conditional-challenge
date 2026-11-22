import { Data, Effect, Random } from 'effect';
import { ChallengeInbox } from '@/challenge/inbox';
import type { Lichess } from '@/challenge/lichess-api';
import { convertRule } from '@/challenge/spec';
import { getLichessPrefs } from '@/challenge/storage';
import { triageAll, triageUntilMatch, type Declination } from '@/challenge/triage';

export class NoMatchingChallenge extends Data.TaggedError('NoMatchingChallenge')<{ readonly message: string }> {
  constructor() {
    super({ message: 'No matching challenge' });
  }
}

export type ActionResult = { readonly kind: 'accepted' } | { readonly kind: 'declined'; readonly count: number };

type Needs = Lichess | ChallengeInbox;

/** Reads the configured rules and the challenges currently in the inbox. */
const loadSpecAndChallenges = Effect.gen(function* () {
  const rule = yield* getLichessPrefs;
  const inbox = yield* ChallengeInbox;
  return { inbox, spec: convertRule(rule), challenges: yield* inbox.incoming };
});

const decline = (declinations: ReadonlyArray<Declination>) =>
  Effect.gen(function* () {
    const inbox = yield* ChallengeInbox;
    yield* Effect.forEach(declinations, ({ challenge, reason }) => inbox.decline(challenge.id, reason));
  });

/**
 * Goes through the challenges in random order and accepts the first one that matches.
 * Non-matching challenges seen on the way are declined, unless the failed rule is silent.
 */
export const acceptMatchingChallenge: Effect.Effect<ActionResult, Error | NoMatchingChallenge, Needs> = Effect.gen(function* () {
  const { inbox, spec, challenges } = yield* loadSpecAndChallenges;
  const { match, declined } = yield* triageUntilMatch(spec, yield* Random.shuffle(challenges));

  yield* decline(declined);
  if (!match) {
    return yield* new NoMatchingChallenge();
  }
  yield* inbox.accept(match.id);
  return { kind: 'accepted' };
});

export const declineUnmatchingChallenges: Effect.Effect<ActionResult, Error, Needs> = Effect.gen(function* () {
  const { spec, challenges } = yield* loadSpecAndChallenges;
  const declined = yield* triageAll(spec, challenges);

  yield* decline(declined);
  return { kind: 'declined', count: declined.length };
});

export const logInfo = Effect.gen(function* () {
  const rules = yield* getLichessPrefs;
  const { challenges } = yield* loadSpecAndChallenges;
  return { rules, challenges };
});
