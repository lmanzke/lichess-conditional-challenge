import { headTail, splitRandomElement, Splitter, sumArray } from './utils';
import { compare, mapOperator, Relation } from './operators';
import { anySpec, applyCondition, SpecFactory } from './spec';
import { AxiosInstance } from 'axios';

export interface Challenger {
  rating: number;
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

export interface LiChessChallenge {
  id: string;
  challenger: Challenger;
  rated: boolean;
  variant: Variant;
}

export interface Team {
  id: string;
}

export type Rule = {
  condition: string | undefined;
  rules: Rule[];
  id: string;
  value: string;
  operator: string;
};

export interface Spec {
  isSatisfied: (challenge: Challenge) => Promise<boolean>;
}

export const extractNumEncounters = (html: string): number => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const scores = Array.from(div.querySelectorAll('.upt__score strong')).map(v => parseFloat(v.innerHTML));

  return sumArray(scores);
};

const compareTeamsFactory = (http: AxiosInstance) => (teams: string, operator: Relation) => async (challenge: Challenge) => {
  const response = await http.get<Team[]>(`/api/team/of/${challenge.username}`);

  return response.data.some(team => compare(operator)(teams)(team.id));
};

export const teamSpecFactory = (http: AxiosInstance) => (teams: string, operator: Relation): Spec => ({
  isSatisfied: compareTeamsFactory(http)(teams, operator),
});

export const encounterSpecFactory = (http: AxiosInstance) => (value: string, operator: Relation): Spec => ({
  isSatisfied: async challenge => {
    const response = await http.get(`/@/${challenge.username}/mini`);
    const encounters = extractNumEncounters(response.data);

    return compare(operator)(value)(encounters);
  },
});

export const ratingSpec = (value: string, operator: Relation): Spec => ({
  isSatisfied: async challenge => {
    return compare(operator)(value)(challenge.challenger.rating);
  },
});

export const ratedSpec = (value: string, operator: Relation): Spec => ({
  isSatisfied: async challenge => {
    return compare(operator)(!!value)(challenge.rated);
  },
});

export const variantSpec = (value: string, operator: Relation): Spec => ({
  isSatisfied: async challenge => {
    return compare(operator)(value)(challenge.variant.key);
  },
});

export const getChallengeElement = (container: HTMLElement): HTMLDivElement => {
  return container.getElementsByClassName('challenges')[0] as HTMLDivElement;
};

const getChallengeInfo = (http: AxiosInstance) => async () => {
  const response = await http.get<{ in: LiChessChallenge[] }>('/challenge', { headers: { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' } });

  return Object.fromEntries(response.data.in.map(v => [v.id, v]));
};

export interface ChallengeRetriever {
  (challengeContainerElement: HTMLElement): Promise<Challenge[]>;
}

export const getChallengeInfosFactory = (http: AxiosInstance): ChallengeRetriever => async (challengeContainerElement: HTMLElement): Promise<Challenge[]> => {
  const remoteChallengeInfo = await getChallengeInfo(http)();

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
      ...remoteChallengeInfo[id],
    };
    acc.push(newChallenge);

    return acc;
  }, []);
};

export interface ChallengeProcessor {
  (collection: Challenge[], results: Challenge[]): Promise<Challenge[]>;
}

const createChallengeProcessor = (
  matcher: (challenge: Challenge) => Promise<boolean>,
  followup: (result: boolean, current: Challenge, matched: Challenge[]) => Promise<boolean>,
  splitter: Splitter
): ChallengeProcessor => {
  const rec = async (collection: Challenge[], results: Challenge[] = []): Promise<Challenge[]> => {
    const { current, other } = splitter(collection);
    if (!current) {
      return results;
    }

    const result = await matcher(current);

    const matched = result ? results.concat([current]) : results;
    const shouldContinue = await followup(result, current, matched);

    if (!shouldContinue) {
      return matched;
    }

    return rec(other, matched);
  };

  return rec;
};

export const declineUnmatchingFactory = (spec: Spec): ChallengeProcessor =>
  createChallengeProcessor(
    async challenge => {
      const result = await spec.isSatisfied(challenge);

      return !result;
    },
    async () => true,
    headTail
  );

export const processChallengesFactory = (spec: Spec): ChallengeProcessor =>
  createChallengeProcessor(
    challenge => spec.isSatisfied(challenge),
    async (result, current) => {
      if (!result) {
        current.decline();
        return true;
      }

      return false;
    },
    splitRandomElement
  );

export interface RuleConverter {
  (rule: Rule): Spec;
}

export const convertRuleFactory = (specFactory: SpecFactory): RuleConverter => {
  const rec = (rule: Rule): Spec => {
    if (typeof rule.condition !== 'undefined') {
      const operator = rule.condition;
      return rule.rules.reduce((currentSpec, currentRule) => {
        return applyCondition(operator, currentSpec, rec(currentRule));
      }, anySpec);
    }

    switch (rule.id) {
      case 'team-name':
        return specFactory.teamSpec(rule.value, mapOperator(rule.operator));
      case 'encounters':
        return specFactory.encounterSpec(rule.value, mapOperator(rule.operator));
      case 'rating':
        return specFactory.ratingSpec(rule.value, mapOperator(rule.operator));
      case 'rated':
        return specFactory.ratedSpec(rule.value, mapOperator(rule.operator));
      case 'variant':
        return specFactory.variantSpec(rule.value, mapOperator(rule.operator));
    }

    return anySpec;
  };

  return rec;
};
