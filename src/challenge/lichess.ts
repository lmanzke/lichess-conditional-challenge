import { HTTP } from './axios';
import { headTail, splitRandomElement, sumArray } from './utils';
import { compare, mapOperator } from './operators';
import { anySpec, applyCondition } from './spec';

export const extractNumEncounters = (html: string) => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const scores = Array.from(div.querySelectorAll('.upt__score strong')).map(v => parseFloat(v.innerHTML));

  return sumArray(scores);
};

const compareTeams = (teams, operator) => async challenge => {
  const response = await HTTP.get(`/api/team/of/${challenge.username}`);

  return response.data.some(team => compare(operator, teams)(team.id));
};

export const teamSpec = (teams, operator) => ({
  isSatisfied: compareTeams(teams, operator),
});

export const encounterSpec = (value, operator) => ({
  isSatisfied: async challenge => {
    const response = await HTTP.get(`/@/${challenge.username}/mini`);
    const encounters = extractNumEncounters(response.data);

    return compare(operator, value)(encounters);
  },
});

export const ratingSpec = (value, operator) => ({
  isSatisfied: async challenge => {
    return compare(operator, value)(challenge.challenger.rating);
  },
});

export const ratedSpec = (value, operator) => ({
  isSatisfied: async challenge => {
    return compare(operator, !!value)(challenge.rated);
  },
});

export const variantSpec = (value, operator) => ({
  isSatisfied: async challenge => {
    return compare(operator, value)(challenge.variant.key);
  },
});

export const getChallengeElement = container => {
  return container.getElementsByClassName('challenges')[0];
};

const getChallengeInfo = async () => {
  const response = await HTTP.get('/challenge', { headers: { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' } });

  return Object.fromEntries(response.data.in.map(v => [v.id, v]));
};

export const getChallengeInfos = async challengeContainerElement => {
  const remoteChallengeInfo = await getChallengeInfo();

  return Array.from(challengeContainerElement.getElementsByClassName('challenge')).map(v => {
    const userLink = v.getElementsByClassName('user-link')[0].attributes.href.value;
    const userLinkParts = userLink.split('/');
    const username = userLinkParts[userLinkParts.length - 1];
    const form = v.getElementsByTagName('form')[0];
    const action = form.attributes.action.value;
    const id = action.split('/')[2];
    const acceptButton = v.getElementsByClassName('accept')[0];
    const declineButton = v.getElementsByClassName('decline')[0];

    const accept = () => {
      acceptButton.click();
    };

    const decline = () => {
      declineButton.click();
    };

    return { id, userLink, username, accept, decline, ...remoteChallengeInfo[id] };
  });
};

const createChallengeProcessor = (matcher, followup, splitter) => {
  const rec = async (collection, results = []) => {
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

export const declineUnmatchingFactory = spec =>
  createChallengeProcessor(
    async challenge => {
      const result = await spec.isSatisfied(challenge);

      return !result;
    },
    async () => true,
    headTail
  );

export const processChallengesFactory = spec =>
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

export const convertRule = rule => {
  if (typeof rule.condition !== 'undefined') {
    const operator = rule.condition;
    return rule.rules.reduce((currentSpec, currentRule) => {
      return applyCondition(operator, currentSpec, convertRule(currentRule));
    }, anySpec);
  }

  switch (rule.id) {
    case 'team-name':
      return teamSpec(rule.value, mapOperator(rule.operator));
    case 'encounters':
      return encounterSpec(rule.value, mapOperator(rule.operator));
    case 'rating':
      return ratingSpec(rule.value, mapOperator(rule.operator));
    case 'rated':
      return ratedSpec(rule.value, mapOperator(rule.operator));
    case 'variant':
      return variantSpec(rule.value, mapOperator(rule.operator));
  }

  return anySpec;
};
