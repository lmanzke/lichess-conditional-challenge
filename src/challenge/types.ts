import type { Effect } from 'effect';
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

export interface Challenger {
  rating: number;
  id: string;
}

export interface Variant {
  key: string;
}

export interface TimeControl {
  type: string;
  limit?: number;
  daysPerTurn?: number;
  increment?: number;
}

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

export interface Matchup {
  nbGames: number;
  users: Record<string, number>;
  matchup?: Matchup;
}

export interface EncounterCount {
  total: number;
  today: number;
}

export interface LiChessChallenge {
  id: string;
  challenger: Challenger;
  rated: boolean;
  variant: Variant;
  timeControl: TimeControl;
  color: string;
}

export interface LichessUser {
  id: string;
  name: string;
  patron?: boolean;
}

export interface DasherInfo {
  user: LichessUser;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  open: boolean;
  leader: LichessUser;
  leaders: LichessUser[];
  nbMembers: number;
  location: string;
}

export type Rule = {
  condition: string | undefined;
  rules: Rule[];
  id: string;
  value: RuleValue;
  operator: string;
  silent: boolean;
};
