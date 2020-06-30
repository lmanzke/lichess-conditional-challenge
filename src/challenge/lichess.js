import { HTTP } from './axios';
import {splitRandomElement, sumArray} from './utils';
import { compare, mapOperator } from './operators';
import {anySpec, applyCondition} from './spec';

const extractNumEncounters = html => {
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

export const getChallengeElement = container => {
  return container.getElementsByClassName('challenges')[0];
};

export const getChallengeInfos = challengeContainerElement => {
  return Array.from(challengeContainerElement.getElementsByClassName('challenge')).map(v => {
    const userLink = v.getElementsByClassName('user-link')[0].attributes.href.value;
    const userLinkParts = userLink.split('/');
    const username = userLinkParts[userLinkParts.length - 1];
    const acceptButton = v.getElementsByClassName('accept')[0];
    const declineButton = v.getElementsByClassName('decline')[0];

    const accept = () => {
      acceptButton.click();
    };

    const decline = () => {
      declineButton.click();
    };

    return { userLink, username, accept, decline };
  });
};

export const processChallenges = async (challenges, spec) => {
  const { current, other } = splitRandomElement(challenges);
  if (current === null) {
    return null;
  }

  const filterResult = await spec.isSatisfied(current);

  if (filterResult) {
    return current;
  }

  current.decline();

  return processChallenges(other, spec);
};

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
  }

  return anySpec;
};
