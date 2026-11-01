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

export enum RuleType {
  TEAM_NAME = 'team-name',
  ENCOUNTERS = 'encounters',
  ENCOUNTERS_TODAY = 'encountersToday',
  RATING = 'rating',
  RATED = 'rated',
  VARIANT = 'variant',
  USER_ID = 'user-id',
  TIMECONTROL_TYPE = 'timecontrolType',
  LIMIT_SECONDS = 'limitSeconds',
  INCREMENT_SECONDS = 'incrementSeconds',
  CHALLENGE_COLOR = 'challengeColor',
}

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

export type Rule = {
  readonly condition?: string | undefined;
  readonly rules: ReadonlyArray<Rule>;
  readonly id: string;
  readonly value: RuleValue;
  readonly operator: string;
  readonly silent: boolean;
};
