import { ofSpecReader, sumArray, unknownError } from './utils';
import { compare, mapOperator, Relation } from './operators';
import { getSpecMonoid, noneSpec } from './spec';
import { AxiosInstance } from 'axios';
import * as E from 'fp-ts/Either';
import * as IOE from 'fp-ts/IOEither';
import { pipe, unsafeCoerce } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import { foldMap } from 'fp-ts/Array';
import { Challenge, LiChessChallenge, Spec, Rule, SpecResult, Team } from '@/challenge/types';

export const extractNumEncounters = (html: string): number => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const scores = Array.from(div.querySelectorAll('.upt__score strong')).map(v => parseFloat(v.innerHTML));

  return sumArray(scores);
};

const compareTeams = (teams: string, operator: Relation) => (teamItems: Team[]) => teamItems.some(team => compare(operator)(teams)(team.id));

const getTeamsOfChallenge = (challenge: Challenge): RTE.ReaderTaskEither<AxiosInstance, Error, Team[]> => http =>
  pipe(
    TE.tryCatch(() => http.get<Team[]>(`/api/team/of/${challenge.username}`), unknownError),
    TE.map(v => v.data)
  );

const getNumEncountersOfChallenge = (challenge: Challenge): RTE.ReaderTaskEither<AxiosInstance, Error, number> => http =>
  pipe(
    TE.tryCatch(() => http.get<string>(`/@/${challenge.username}/mini`), unknownError),
    TE.map(v => v.data),
    TE.map(extractNumEncounters)
  );

export const teamReaderSpec = (teams: string, operator: Relation, silent = false): Spec => (challenge: Challenge) =>
  pipe(challenge, getTeamsOfChallenge, RTE.map(compareTeams(teams, operator)), RTE.map(getSpecResult(silent)));

export const encounterSpec = (value: string, operator: Relation, silent = false): Spec => challenge =>
  pipe(challenge, getNumEncountersOfChallenge, RTE.map(compare(operator)(value)), RTE.map(getSpecResult(silent)));

export const simpleSpec = (mapperFn: (challenge: Challenge) => string | number | boolean) => (value: string, operator: Relation, silent = false): Spec => (challenge: Challenge) =>
  pipe(challenge, mapperFn, compare(operator)(value), getSpecResult(silent), ofSpecReader);

export const ratingReaderSpec = simpleSpec(challenge => challenge.challenger.rating);
export const ratedReaderSpec = simpleSpec(challenge => challenge.rated);
export const variantReaderSpec = simpleSpec(challenge => challenge.variant.key);
export const userIdReaderSpec = simpleSpec(challenge => challenge.challenger.id);

const getSpecResult = (silent: boolean) => (result: boolean): SpecResult => ({
  isSatisfied: result,
  silent,
});

export const getChallengeElement = (container: HTMLElement): IOE.IOEither<Error, HTMLDivElement> => () => {
  return pipe(
    container.getElementsByClassName('challenges').item(0),
    E.fromNullable(Error('Element not found')),
    E.map(v => unsafeCoerce<Element, HTMLDivElement>(v))
  );
};

const getChallengeInfoReader: RTE.ReaderTaskEither<AxiosInstance, Error, { [k: string]: LiChessChallenge }> = http =>
  pipe(
    TE.tryCatch(
      () => http.get<{ in: LiChessChallenge[] }>('/challenge', { headers: { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' } }),
      unknownError
    ),
    TE.map(v => Object.fromEntries(v.data.in.map(v => [v.id, v])))
  );

export const getChallengeInfosReader = (challengeContainerElement: HTMLElement): RTE.ReaderTaskEither<AxiosInstance, Error, Challenge[]> =>
  pipe(
    getChallengeInfoReader,
    RTE.map(remoteChallenges => {
      return Array.from(challengeContainerElement.getElementsByClassName('challenge')).reduce((acc: Challenge[], v) => {
        const userLink = v.getElementsByClassName('user-link')[0].attributes.getNamedItem('href')?.value;

        if (!userLink) {
          return acc;
        }

        const userLinkParts = userLink?.split('/');
        const username = userLinkParts[userLinkParts.length - 1];
        const form = v.getElementsByTagName('form')[0];
        const action = form.attributes.getNamedItem('action')?.value;
        const id = action?.split('/')[2];

        if (!id) {
          return acc;
        }

        const acceptButton = v.getElementsByClassName('accept')[0] as HTMLButtonElement;
        const declineButton = v.getElementsByClassName('decline')[0] as HTMLButtonElement;

        const accept = () => {
          acceptButton.click();
        };

        const decline = () => {
          declineButton.click();
        };
        const newChallenge: Challenge = {
          userLink,
          username,
          accept,
          decline,
          ...remoteChallenges[id],
        };
        acc.push(newChallenge);

        return acc;
      }, []);
    })
  );

const mapRuleName = (ruleName: string) => {
  switch (ruleName) {
    case 'team-name':
      return teamReaderSpec;
    case 'encounters':
      return encounterSpec;
    case 'rating':
      return ratingReaderSpec;
    case 'rated':
      return ratedReaderSpec;
    case 'variant':
      return variantReaderSpec;
    case 'user-id':
      return userIdReaderSpec;
    default:
      return () => noneSpec;
  }
};

const mapSimpleRule = (rule: Rule): Spec => {
  const ruleConstructor = mapRuleName(rule.id);
  return ruleConstructor(rule.value, mapOperator(rule.operator), rule.silent);
};

export const convertRuleReader = (rule: Rule): Spec => {
  const reduceRules = (condition: string, rules: Rule[]): Spec => {
    const conditionMonoid = getSpecMonoid(condition);

    return foldMap(conditionMonoid)(convertRuleReader)(rules);
  };

  if (typeof rule.condition !== 'undefined') {
    return reduceRules(rule.condition, rule.rules);
  }

  return mapSimpleRule(rule);
};
