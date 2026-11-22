import type { Effect } from 'effect';
import type { Challenger, TimeControl, Variant } from '@/challenge/lichess-schemas';
import type { Lichess } from '@/challenge/lichess-api';

export enum DeclineReason {
  RULE_FAILED = 'ruleFailed',
  TOO_LITTLE_TIME = 'toofast',
  TOO_MUCH_TIME = 'tooslow',
  BAD_TIME = 'timecontrol',
  ONLY_RATED = 'rated',
  ONLY_UNRATED = 'casual',
  NO_VARIANTS = 'standard',
  NOT_THIS_VARIANT = 'variant',
  NO_BOTS = 'nobot',
  ONLY_BOTS = 'onlybot',
}

export type RuleValueType = string | number | boolean | string[];
/** What the options page stores; 'between' rules hold two numbers. */
export type RuleValue = RuleValueType | number[];

export type SatisfiedSpecResult = { isSatisfied: true };
export type UnsatisfiedSpecResult = { isSatisfied: false; silent: boolean; reason: DeclineReason };
export type SpecResult = SatisfiedSpecResult | UnsatisfiedSpecResult;

export type ChallengeInfo = (SatisfiedSpecResult | UnsatisfiedSpecResult) & { challenge: Challenge };
export type UnsatisfyingChallengeInfo = UnsatisfiedSpecResult & { challenge: Challenge };

export type Spec = (challenge: Challenge) => Effect.Effect<SpecResult, Error, Lichess>;

export type { Challenger, DasherInfo, LiChessChallenge, Matchup, Team, TimeControl, Variant } from '@/challenge/lichess-schemas';

export interface Challenge {
  id: string;
  userLink: string;
  username: string;
  color: string;
  challenger: Challenger;
  rated: boolean;
  timeControl: TimeControl;
  variant: Variant;
  accept: () => void;
  decline: (reason: DeclineReason) => void;
}

export interface EncounterCount {
  total: number;
  today: number;
}

/** A leaf of the rule tree: compares one field of a challenge with a value. */
export type Rule = {
  readonly field: string;
  /** The code of a relation, see `mapRelation`. */
  readonly relation: string;
  readonly value: RuleValue;
  readonly silent: boolean;
};

export type Combinator = 'AND' | 'OR';

/** An inner node of the rule tree: joins its children with a combinator. */
export type RuleGroup = {
  readonly combinator: Combinator;
  readonly children: ReadonlyArray<RuleNode>;
};

export type RuleNode = Rule | RuleGroup;

export const isRuleGroup = (node: RuleNode): node is RuleGroup => 'combinator' in node;
