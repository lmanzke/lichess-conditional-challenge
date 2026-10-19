import { Effect } from 'effect';
import { DeclineReason, type Spec } from '@/challenge/types';

export const anySpec: Spec = () => Effect.succeed({ isSatisfied: true });
export const noneSpec: Spec = () => Effect.succeed({ isSatisfied: false, silent: false, reason: DeclineReason.RULE_FAILED });

/** Short-circuits: `second` only runs (and only causes requests) if `first` is satisfied. */
export const andSpec =
  (first: Spec, second: Spec): Spec =>
  challenge =>
    Effect.flatMap(first(challenge), result => (result.isSatisfied ? second(challenge) : Effect.succeed(result)));

/** Short-circuits: `second` only runs if `first` is not satisfied. */
export const orSpec =
  (first: Spec, second: Spec): Spec =>
  challenge =>
    Effect.flatMap(first(challenge), result => (result.isSatisfied ? Effect.succeed(result) : second(challenge)));

/** Folds specs with the combinator for `condition` ('AND', anything else is 'OR'). Empty AND is always satisfied, empty OR never. */
export const combineSpecs = (condition: string, specs: Spec[]): Spec => (condition === 'AND' ? specs.reduce(andSpec, anySpec) : specs.reduce(orSpec, noneSpec));
