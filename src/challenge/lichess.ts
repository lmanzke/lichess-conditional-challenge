import { memoizeReaderTaskEither, ofSpecReader, unknownError } from './utils';
import { compare, mapOperator, Relation } from './operators';
import { getSpecMonoid } from './spec';
import { AxiosInstance, AxiosResponse } from 'axios';
import * as E from 'fp-ts/Either';
import * as IOE from 'fp-ts/IOEither';
import { flow, pipe, unsafeCoerce } from 'fp-ts/function';
import * as RTE from 'fp-ts/ReaderTaskEither';
import * as TE from 'fp-ts/TaskEither';
import { foldMap } from 'fp-ts/Array';
import { Challenge, DasherInfo, DeclineReason, EncounterCount, LiChessChallenge, Matchup, Rule, RuleType, RuleValueType, Spec, SpecResult, Team } from '@/challenge/types';

export const extractNumEncounters = ({ match }: { match: Matchup }): EncounterCount => {
  const encountersTotal = match.nbGames;
  const encountersToday = match.matchup ? match.matchup.nbGames : 0;

  return { total: encountersTotal, today: encountersToday };
};

const compareTeams = (teams: RuleValueType, operator: Relation) => (teamItems: Team[]) => teamItems.some(team => compare(operator)(teams)(team.id));

const getTeamsOfChallenge = (challenge: Challenge): RTE.ReaderTaskEither<AxiosInstance, Error, Team[]> => http =>
  pipe(
    TE.tryCatch(() => http.get<Team[]>(`/api/team/of/${challenge.username}`), unknownError),
    TE.map(v => v.data)
  );

const getAccountInfo: RTE.ReaderTaskEither<AxiosInstance, Error, AxiosResponse<DasherInfo>> = memoizeReaderTaskEither(http =>
  TE.tryCatch(
    () => http.get<DasherInfo>('/dasher', { headers: { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' } }),
    unknownError
  )
);

const getNumEncountersOfChallenge = (challenge: Challenge): RTE.ReaderTaskEither<AxiosInstance, Error, EncounterCount> =>
  pipe(
    RTE.bindTo('accountInfo')(getAccountInfo),
    RTE.bind('match', ({ accountInfo }) => http =>
      TE.tryCatch(() => {
        return http.get<Matchup>(`/api/crosstable/${challenge.username}/${accountInfo.data.user.id}?matchup=1`);
      }, unknownError)
    ),
    RTE.map(v => ({ accountInfo: v.accountInfo.data, match: v.match.data })),
    RTE.map(extractNumEncounters)
  );

type DeclinedHandler = () => { silent: boolean; reason: DeclineReason };
const defaultDeclineHandler = () => ({ silent: false, reason: DeclineReason.RULE_FAILED });

export const teamReaderSpec = (value: RuleValueType, operator: Relation, declineHandler = defaultDeclineHandler): Spec =>
  flow(getTeamsOfChallenge, RTE.map(compareTeams(value, operator)), RTE.map(getSpecResult(declineHandler)));

export const encounterSpec = (value: RuleValueType, operator: Relation, declineHandler = defaultDeclineHandler): Spec =>
  flow(
    getNumEncountersOfChallenge,
    RTE.map(v => v.total),
    RTE.map(compare(operator)(value)),
    RTE.map(getSpecResult(declineHandler))
  );

export const encounterTodaySpec = (value: RuleValueType, operator: Relation, declineHandler = defaultDeclineHandler): Spec =>
  flow(
    getNumEncountersOfChallenge,
    RTE.map(v => v.today),
    RTE.map(compare(operator)(value)),
    RTE.map(getSpecResult(declineHandler))
  );

export const simpleSpec = (mapperFn: (challenge: Challenge) => RuleValueType) => (value: RuleValueType, operator: Relation, declineHandler = defaultDeclineHandler): Spec =>
  flow(mapperFn, compare(operator)(value), getSpecResult(declineHandler), ofSpecReader);

export const ratingReaderSpec = simpleSpec(challenge => challenge.challenger.rating);
export const ratedReaderSpec = simpleSpec(challenge => challenge.rated);
export const variantReaderSpec = simpleSpec(challenge => challenge.variant.key);
export const userIdReaderSpec = simpleSpec(challenge => challenge.challenger.id);

const getSpecResult = (declineHandler: DeclinedHandler) => (result: boolean): SpecResult => {
  if (result) {
    return {
      isSatisfied: true,
    };
  }

  return {
    isSatisfied: false,
    ...declineHandler(),
  };
};

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
    case RuleType.ENCOUNTERS_TODAY:
      return RuleType.ENCOUNTERS_TODAY;
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
    case RuleType.ENCOUNTERS_TODAY:
      return encounterTodaySpec;
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

const getDeclineHandler = (value: RuleValueType, ruleType: RuleType, operator: Relation, silent: boolean): DeclinedHandler => () => {
  const unmappedRuleTypes: RuleType[] = [RuleType.ENCOUNTERS, RuleType.TEAM_NAME, RuleType.USER_ID, RuleType.RATING];

  if (unmappedRuleTypes.includes(ruleType)) {
    return {
      silent,
      reason: DeclineReason.RULE_FAILED,
    };
  }

  if (ruleType === RuleType.RATED) {
    return {
      silent,
      reason: value ? DeclineReason.ONLY_RATED : DeclineReason.ONLY_UNRATED,
    };
  }

  if (!Array.isArray(value) || value.length === 0) {
    return {
      silent,
      reason: DeclineReason.RULE_FAILED,
    };
  }

  if (value.length !== 1) {
    return {
      silent,
      reason: DeclineReason.NOT_THIS_VARIANT,
    };
  }

  if (value[0] === 'standard') {
    return {
      silent,
      reason: DeclineReason.NO_VARIANTS,
    };
  }

  return {
    silent,
    reason: DeclineReason.NOT_THIS_VARIANT,
  };
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
  return ruleConstructor(mappedValue, operator, getDeclineHandler(mappedValue, ruleType, operator, rule.silent));
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
