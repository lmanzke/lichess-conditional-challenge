import { JpexInstance } from 'jpex';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import * as SRTE from 'fp-ts/StateReaderTaskEither';
import * as IO from 'fp-ts/IO';
import { AxiosInstance } from 'axios';
import { pipe, Refinement } from 'fp-ts/function';
import { Relation } from '@/challenge/operators';

export interface AppProps {
  container: HTMLElement;
  dependencies: JpexInstance;
}

export type UnmappedDeclineReason = {
  isMapped: false;
};

export type UserIsBlacklisted = { reason: 'USER_IS_BLACKLISTED' } & UnmappedDeclineReason;

export type EnumeratedDeclineReason = UserIsBlacklisted;

export type MappedDeclineReason = {
  isMapped: true;
  mappedReason: string;
};

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
  RATING = 'rating',
  RATED = 'rated',
  VARIANT = 'variant',
  USER_ID = 'user-id',
}

export type SatisfiedSpecResult = { isSatisfied: true };
export type UnsatisfiedSpecResult = { isSatisfied: false; silent: boolean; reason: DeclineReason };

export type SpecResult = SatisfiedSpecResult | UnsatisfiedSpecResult;

export const specResultIsSatisfied: Refinement<SpecResult, SatisfiedSpecResult> = (a: SpecResult): a is SatisfiedSpecResult => a.isSatisfied;
export const specResultIsUnsatisfied: Refinement<SpecResult, UnsatisfiedSpecResult> = (a: SpecResult): a is UnsatisfiedSpecResult => !a.isSatisfied;

export type SatisfyingChallengeInfo = SatisfiedSpecResult & { challenge: Challenge };
export type UnsatisfyingChallengeInfo = UnsatisfiedSpecResult & { challenge: Challenge };

export type ChallengeInfo = SatisfyingChallengeInfo | UnsatisfyingChallengeInfo;
export type DetailedChallengeInfo = { info: ChallengeInfo; checkedConditions: CheckedCondition[] };

export const challengeInfoIsSatisfied: Refinement<ChallengeInfo, SatisfyingChallengeInfo> = (a: SpecResult): a is SatisfyingChallengeInfo => a.isSatisfied;
export const challengeInfoIsUnsatisfied: Refinement<ChallengeInfo, UnsatisfyingChallengeInfo> = (a: SpecResult): a is UnsatisfyingChallengeInfo => !a.isSatisfied;

export type ReaderTypeOf<T> = RTE.ReaderTaskEither<AxiosInstance, Error, T>;
export type CheckedCondition = {
  matched: boolean;
  fieldName: string;
  operator: Relation;
  fieldValue: RuleValueType;
  expectedFieldValue: RuleValueType;
};
export type SpecReaderTypeOf<T> = SRTE.StateReaderTaskEither<CheckedCondition[], AxiosInstance, Error, T>;
export type Spec = (challenge: Challenge) => SpecReaderTypeOf<SpecResult>;

export interface Challenger {
  rating: number;
  id: string;
}

export interface Variant {
  key: string;
}

export interface Challenge {
  id: string;
  userLink: string;
  username: string;
  challenger: Challenger;
  rated: boolean;
  variant: Variant;
  accept: IO.IO<void>;
  decline: (reason: DeclineReason) => IO.IO<void>;
}

export interface Matchup {
  users: {
    [key: string]: number;
    nbGames: number;
  };
  matchup?: Matchup;
}

export interface LiChessChallenge {
  id: string;
  challenger: Challenger;
  rated: boolean;
  variant: Variant;
}

export interface LichessUser {
  id: string;
  name: string;
  patron?: boolean;
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
