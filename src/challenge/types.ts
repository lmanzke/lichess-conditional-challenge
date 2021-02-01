import { JpexInstance } from 'jpex';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { AxiosInstance } from 'axios';

export interface AppProps {
  container: HTMLElement;
  dependencies: JpexInstance;
}

export type ChallengeInfo = {
  challenge: Challenge;
  isSatisfied: boolean;
  silent: boolean;
};

export type ReaderTypeOf<T> = RTE.ReaderTaskEither<AxiosInstance, Error, T>;
export type Spec = (challenge: Challenge) => RTE.ReaderTaskEither<AxiosInstance, Error, SpecResult>;

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
  accept: () => void;
  decline: () => void;
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

export interface SpecResult {
  isSatisfied: boolean;
  silent: boolean;
}
