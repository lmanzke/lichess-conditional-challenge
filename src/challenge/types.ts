import { JpexInstance } from 'jpex';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as IO from 'fp-ts/IO';
import { AxiosInstance } from 'axios';
import { Refinement } from 'fp-ts/function';

export interface AppProps {
  container: HTMLElement;
  dependencies: JpexInstance;
}

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

export type SatisfyingChallengeInfo = { challenge: Challenge; isSatisfied: true };
export type UnsatisfyingChallengeInfo = { challenge: Challenge; isSatisfied: false; silent: boolean; reason: DeclineReason };

export type ChallengeInfo = SatisfyingChallengeInfo | UnsatisfyingChallengeInfo;

export const challengeInfoIsSatisfied: Refinement<ChallengeInfo, SatisfyingChallengeInfo> = (a: SpecResult): a is SatisfyingChallengeInfo => a.isSatisfied;
export const challengeInfoIsUnsatisfied: Refinement<ChallengeInfo, UnsatisfyingChallengeInfo> = (a: SpecResult): a is UnsatisfyingChallengeInfo => !a.isSatisfied;

export type ReaderTypeOf<T> = RTE.ReaderTaskEither<AxiosInstance, Error, T>;
export type Spec = (challenge: Challenge) => RTE.ReaderTaskEither<AxiosInstance, Error, SpecResult>;

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
  accept: IO.IO<void>;
  decline: (reason: DeclineReason) => IO.IO<void>;
}

export interface Matchup {
  nbGames: number;
  users: {
    [key: string]: number;
    nbGames: number;
  };
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
  value: string;
  operator: string;
  silent: boolean;
};

export type SatisfiedSpecResult = { isSatisfied: true };
export type UnsatisfiedSpecResult = { isSatisfied: false; silent: boolean; reason: DeclineReason };

export type SpecResult = SatisfiedSpecResult | UnsatisfiedSpecResult;

export const specResultIsSatisfied: Refinement<SpecResult, SatisfiedSpecResult> = (a: SpecResult): a is SatisfiedSpecResult => a.isSatisfied;
export const specResultIsUnsatisfied: Refinement<SpecResult, UnsatisfiedSpecResult> = (a: SpecResult): a is UnsatisfiedSpecResult => !a.isSatisfied;
