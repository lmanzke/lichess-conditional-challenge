import { Effect, Option } from 'effect';
import { Lichess } from '@/challenge/lichess-api';
import { compare, mapOperator, type Relation } from '@/challenge/operators';
import { combineSpecs } from '@/challenge/spec';
import {
  DeclineReason,
  RuleType,
  type Challenge,
  type EncounterCount,
  type LiChessChallenge,
  type Matchup,
  type Rule,
  type RuleValue,
  type RuleValueType,
  type Spec,
  type SpecResult,
} from '@/challenge/types';

export const extractNumEncounters = (match: Matchup): EncounterCount => ({
  total: match.nbGames,
  today: match.matchup ? match.matchup.nbGames : 0,
});

type DeclinedHandler = () => { silent: boolean; reason: DeclineReason };
const defaultDeclineHandler: DeclinedHandler = () => ({ silent: false, reason: DeclineReason.RULE_FAILED });

const getSpecResult =
  (declineHandler: DeclinedHandler) =>
  (result: boolean): SpecResult =>
    result ? { isSatisfied: true } : { isSatisfied: false, ...declineHandler() };

const getNumEncounters = (challenge: Challenge) =>
  Effect.gen(function* () {
    const lichess = yield* Lichess;
    const userId = yield* lichess.currentUserId;
    return extractNumEncounters(yield* lichess.crosstable(challenge.username, userId));
  });

type SpecFactory = (value: RuleValue, operator: Relation, declineHandler?: DeclinedHandler) => Spec;

export const teamSpec: SpecFactory =
  (value, operator, declineHandler = defaultDeclineHandler) =>
  challenge =>
    Effect.gen(function* () {
      const lichess = yield* Lichess;
      const teams = yield* lichess.teamsOf(challenge.username);
      return getSpecResult(declineHandler)(teams.some(team => compare(operator)(value)(team.id)));
    });

const encounterSpecOf =
  (select: (count: EncounterCount) => number): SpecFactory =>
  (value, operator, declineHandler = defaultDeclineHandler) =>
  challenge =>
    getNumEncounters(challenge).pipe(Effect.map(count => getSpecResult(declineHandler)(compare(operator)(value)(select(count)))));

export const encounterSpec = encounterSpecOf(count => count.total);
export const encounterTodaySpec = encounterSpecOf(count => count.today);

const simpleSpec =
  (select: (challenge: Challenge) => RuleValueType): SpecFactory =>
  (value, operator, declineHandler = defaultDeclineHandler) =>
  challenge =>
    Effect.succeed(getSpecResult(declineHandler)(compare(operator)(value)(select(challenge))));

export const ratingSpec = simpleSpec(challenge => challenge.challenger.rating);
export const ratedSpec = simpleSpec(challenge => challenge.rated);
export const challengeTypeSpec = simpleSpec(challenge => challenge.timeControl.type);
export const timeLimitSpec = simpleSpec(challenge => challenge.timeControl.limit || 0);
export const incrementSpec = simpleSpec(challenge => challenge.timeControl.increment || 0);
export const colorSpec = simpleSpec(challenge => challenge.color);
export const variantSpec = simpleSpec(challenge => challenge.variant.key);
export const userIdSpec = simpleSpec(challenge => challenge.challenger.id);

export const getChallengeElement = (container: HTMLElement): Effect.Effect<HTMLElement, Error> =>
  Option.match(Option.fromNullishOr(container.getElementsByClassName('challenges').item(0)), {
    onNone: () => Effect.fail(new Error('Element not found')),
    onSome: element => Effect.succeed(element as HTMLElement),
  });

/** Combines the challenges rendered in the DOM (which have the buttons) with the ones the lichess API knows (which have the data). */
export const getChallenges = (challengeContainerElement: HTMLElement): Effect.Effect<Challenge[], Error, Lichess> =>
  Effect.gen(function* () {
    const lichess = yield* Lichess;
    const remoteChallenges = new Map<string, LiChessChallenge>((yield* lichess.incomingChallenges).map(c => [c.id, c]));

    return Array.from(challengeContainerElement.getElementsByClassName('challenge')).flatMap((element): Challenge[] => {
      const userLink = element.getElementsByClassName('user-link')[0]?.getAttribute('href');
      const id = element.getElementsByTagName('form')[0]?.getAttribute('action')?.split('/')[2];
      const remote = id ? remoteChallenges.get(id) : undefined;

      if (!userLink || !id || !remote) {
        return [];
      }

      const acceptButton = element.getElementsByClassName('accept')[0] as HTMLButtonElement;
      const declineButton = element.getElementsByClassName('decline')[0] as HTMLButtonElement;
      const declineReasonSelect = element.getElementsByClassName('decline-reason')[0] as HTMLSelectElement;

      return [
        {
          ...remote,
          userLink,
          username: userLink.split('/').pop() as string,
          accept: () => acceptButton.click(),
          decline: reason => {
            if (reason === DeclineReason.RULE_FAILED) {
              declineButton.click();
              return;
            }

            declineReasonSelect.value = reason;
            declineReasonSelect.dispatchEvent(new Event('change'));
          },
        },
      ];
    });
  });

const specFactories: Record<RuleType, SpecFactory> = {
  [RuleType.TEAM_NAME]: teamSpec,
  [RuleType.ENCOUNTERS]: encounterSpec,
  [RuleType.ENCOUNTERS_TODAY]: encounterTodaySpec,
  [RuleType.RATING]: ratingSpec,
  [RuleType.RATED]: ratedSpec,
  [RuleType.VARIANT]: variantSpec,
  [RuleType.USER_ID]: userIdSpec,
  [RuleType.INCREMENT_SECONDS]: incrementSpec,
  [RuleType.TIMECONTROL_TYPE]: challengeTypeSpec,
  [RuleType.CHALLENGE_COLOR]: colorSpec,
  [RuleType.LIMIT_SECONDS]: timeLimitSpec,
};

const isRuleType = (name: string): name is RuleType => name in specFactories;

const getDeclineHandler =
  (value: RuleValue, ruleType: RuleType, silent: boolean): DeclinedHandler =>
  () => {
    const reason = ((): DeclineReason => {
      if (ruleType === RuleType.RATED) {
        return value ? DeclineReason.ONLY_RATED : DeclineReason.ONLY_UNRATED;
      }
      if (ruleType !== RuleType.VARIANT || !Array.isArray(value) || value.length === 0) {
        return DeclineReason.RULE_FAILED;
      }
      return value.length === 1 && value[0] === 'standard' ? DeclineReason.NO_VARIANTS : DeclineReason.NOT_THIS_VARIANT;
    })();

    return { silent, reason };
  };

const mapRuleValue = (ruleType: RuleType, value: RuleValue): RuleValue => {
  if (ruleType === RuleType.TEAM_NAME || ruleType === RuleType.USER_ID || ruleType === RuleType.VARIANT) {
    return value;
  }
  if (ruleType === RuleType.RATED) {
    return !!value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (Array.isArray(value) || typeof value === 'number') {
    return value;
  }

  return parseInt(value);
};

const mapSimpleRule = (rule: Rule): Spec => {
  // Unknown rule ids fall back to the team rule, as before.
  const ruleType = isRuleType(rule.id) ? rule.id : RuleType.TEAM_NAME;
  const value = mapRuleValue(ruleType, rule.value);

  return specFactories[ruleType](value, mapOperator(rule.operator), getDeclineHandler(value, ruleType, rule.silent));
};

export const convertRule = (rule: Rule): Spec => (rule.condition !== undefined ? combineSpecs(rule.condition, rule.rules.map(convertRule)) : mapSimpleRule(rule));
