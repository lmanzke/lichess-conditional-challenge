import { ofSpecReader, sumArray, unknownError } from './utils';
import { compare, mapOperator, Relation } from './operators';
import { getSpecMonoid } from './spec';
import { AxiosInstance } from 'axios';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as IOE from 'fp-ts/IOEither';
import { flow, pipe, unsafeCoerce } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import { findFirst, foldMap } from 'fp-ts/Array';
import { Challenge, DeclineReason, LiChessChallenge, Rule, RuleType, RuleValueType, Spec, SpecResult, Team } from '@/challenge/types';

export const extractNumEncounters = (html: string): number => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const scores = Array.from(div.querySelectorAll('.upt__score strong')).map(v => parseFloat(v.innerHTML));

  return sumArray(scores);
};

const compareTeams = (teams: RuleValueType, operator: Relation) => (teamItems: Team[]) => teamItems.some(team => compare(operator)(teams)(team.id));

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

export const teamReaderSpec = (value: RuleValueType, operator: Relation, silent = false): Spec => (challenge: Challenge) =>
  pipe(challenge, getTeamsOfChallenge, RTE.map(compareTeams(value, operator)), RTE.map(getSpecResult2('teamId', operator, value, silent)));

export const encounterSpec = (value: RuleValueType, operator: Relation, silent = false): Spec => challenge =>
  pipe(challenge, getNumEncountersOfChallenge, RTE.map(compare(operator)(value)), RTE.map(getSpecResult2('numEncounters', operator, value, silent)));

export type SimpleSpec = (value: RuleValueType, operator: Relation, silent?: boolean) => (challenge: Challenge) => SpecResult;
export const simpleSpec = (fieldName: string, mapperFn: (challenge: Challenge) => RuleValueType): SimpleSpec => (value: RuleValueType, operator: Relation, silent = false) => (
  challenge: Challenge
) => pipe(challenge, mapperFn, compare(operator)(value), getSpecResult2(fieldName, operator, value, silent));
const toReaderSpec = (spec: SimpleSpec) => (value: RuleValueType, operator: Relation, silent = false): Spec => flow(spec(value, operator, silent), ofSpecReader);

export const ratingSpec: SimpleSpec = simpleSpec('rating', challenge => challenge.challenger.rating);
export const ratingReaderSpec = toReaderSpec(ratingSpec);

export const ratedSpec = simpleSpec('rated', challenge => challenge.rated);
export const ratedReaderSpec = toReaderSpec(ratedSpec);

export const variantSpec = simpleSpec('variant', challenge => challenge.variant.key);
export const variantReaderSpec = toReaderSpec(variantSpec);

export const userIdSpec = simpleSpec('userId', challenge => challenge.challenger.id);
export const userIdReaderSpec = toReaderSpec(userIdSpec);

const getOppositeOperator = (operator: Relation): Relation => {
  const pairs: Array<[Relation, Relation]> = [
    [Relation.IN, Relation.NOT_IN],
    [Relation.EQUAL, Relation.NOT_EQUAL],
    [Relation.GREATER_THAN, Relation.LESS_THAN_EQUAL],
    [Relation.LESS_THAN, Relation.GREATER_THAN_EQUAL],
    [Relation.BETWEEN, Relation.NOT_BETWEEN],
  ];

  return pipe(
    pairs,
    findFirst(([a, b]) => a === operator || b === operator),
    O.fold(
      () => Relation.NOT_EQUAL,
      ([a, b]) => (a === operator ? b : a)
    )
  );
};

const getSpecResult2 = (fieldName: string, relation: Relation, targetValue: RuleValueType, silent: boolean) => (result: boolean): SpecResult => {
  if (result) {
    return {
      isSatisfied: true,
    };
  }

  return {
    isSatisfied: false,
    silent,
    targetValue,
    fieldName,
    operator: getOppositeOperator(relation),
  };
};

export const getChallengeElement = (container: HTMLElement): IOE.IOEither<Error, HTMLDivElement> => () => {
  return pipe(
    container.getElementsByClassName('challenges').item(0),
    E.fromNullable(Error('No pending challenges')),
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
        const declineReasonSelect = v.getElementsByClassName('decline-reason')[0] as HTMLSelectElement;

        const accept = () => {
          acceptButton.click();
        };

        const decline = (reason: DeclineReason) => () => {
          if (reason === DeclineReason.RULE_FAILED) {
            declineButton.click();
            return;
          }

          declineReasonSelect.value = reason;
          const event = new Event('change');
          declineReasonSelect.dispatchEvent(event);
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

const getRuleTypeFromName = (ruleName: string): RuleType => {
  switch (ruleName) {
    case RuleType.TEAM_NAME:
      return RuleType.TEAM_NAME;
    case RuleType.ENCOUNTERS:
      return RuleType.ENCOUNTERS;
    case RuleType.RATING:
      return RuleType.RATING;
    case RuleType.RATED:
      return RuleType.RATED;
    case RuleType.VARIANT:
      return RuleType.VARIANT;
    case RuleType.USER_ID:
      return RuleType.USER_ID;
    default:
      return RuleType.TEAM_NAME;
  }
};

const mapRuleName = (ruleType: RuleType) => {
  switch (ruleType) {
    case RuleType.TEAM_NAME:
      return teamReaderSpec;
    case RuleType.ENCOUNTERS:
      return encounterSpec;
    case RuleType.RATING:
      return ratingReaderSpec;
    case RuleType.RATED:
      return ratedReaderSpec;
    case RuleType.VARIANT:
      return variantReaderSpec;
    case RuleType.USER_ID:
      return userIdReaderSpec;
  }
};

const mapRuleValue = (ruleType: RuleType, value: RuleValueType): RuleValueType => {
  if ([RuleType.TEAM_NAME, RuleType.USER_ID, RuleType.VARIANT].includes(ruleType)) {
    return value;
  }
  if ([RuleType.RATED].includes(ruleType)) {
    return !!value;
  }

  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'number') {
    return value;
  }

  return parseInt(value);
};

const mapSimpleRule = (rule: Rule): Spec => {
  const ruleType = getRuleTypeFromName(rule.id);
  const ruleConstructor = mapRuleName(ruleType);
  const operator = mapOperator(rule.operator);
  const mappedValue = mapRuleValue(ruleType, rule.value);
  return ruleConstructor(mappedValue, operator, rule.silent);
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
