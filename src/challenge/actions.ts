import { Effect, Random } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import { convertRule, getChallengeElement, getChallenges } from '@/challenge/lichess';
import { getLichessPrefs } from '@/challenge/storage';
import type { Challenge, Spec, UnsatisfyingChallengeInfo } from '@/challenge/types';

/** Reads the configured rules and the challenges currently shown in `container`. */
const loadSpecAndChallenges = (container: HTMLElement) =>
  Effect.gen(function* () {
    const rule = yield* getLichessPrefs;
    const element = yield* getChallengeElement(container);
    return { spec: convertRule(rule), challenges: yield* getChallenges(element) };
  });

/**
 * Goes through the challenges in random order and accepts the first one that matches.
 * Non-matching challenges are declined on the way, unless the failed rule is silent.
 */
export const findMatchingChallenge = (spec: Spec, challenges: Challenge[]): Effect.Effect<Challenge, Error, Lichess> =>
  Effect.gen(function* () {
    for (const challenge of yield* Random.shuffle(challenges)) {
      const result = yield* spec(challenge);

      if (result.isSatisfied) {
        return challenge;
      }
      if (!result.silent) {
        challenge.decline(result.reason);
      }
    }

    return yield* Effect.fail(new Error('No matching challenge'));
  });

export const acceptMatchingChallenge = (container: HTMLElement): Effect.Effect<string, Error, Lichess> =>
  Effect.gen(function* () {
    const { spec, challenges } = yield* loadSpecAndChallenges(container);
    const challenge = yield* findMatchingChallenge(spec, challenges);
    challenge.accept();
    return 'Accepted a challenge';
  });

export const declineUnmatchingChallenges = (container: HTMLElement): Effect.Effect<string, Error, Lichess> =>
  Effect.gen(function* () {
    const { spec, challenges } = yield* loadSpecAndChallenges(container);
    const results = yield* Effect.forEach(challenges, challenge => Effect.map(spec(challenge), result => ({ ...result, challenge })), { concurrency: 4 });
    const toDecline = results.filter((info): info is UnsatisfyingChallengeInfo => !info.isSatisfied && !info.silent);

    toDecline.forEach(info => info.challenge.decline(info.reason));
    return `Declined ${toDecline.length} challenges`;
  });

export const logInfo = (container: HTMLElement) =>
  Effect.gen(function* () {
    const rules = yield* getLichessPrefs;
    const { challenges } = yield* loadSpecAndChallenges(container);
    return { rules, challenges };
  });
