<template>
  <div class="extender">
    <button class="fbt" @click="team">Apply extension preferences</button>
  </div>
</template>

<script>
import { HTTP } from './axios';
import { andSpec, anySpec, orSpec } from './spec';

const splitRandomElement = elements => {
  if (elements.length === 0) {
    return { current: null, other: [] };
  }
  const index = Math.floor(Math.random() * elements.length);

  return {
    current: elements[index],
    other: elements.filter((_v, i) => i !== index),
  };
};

const processChallenges = async (challenges, spec) => {
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

const compareTeams = (teams, operator) => async challenge => {
  const response = await HTTP.get(`/api/team/of/${challenge.username}`);

  return response.data.some(team => compare(operator, teams)(team.id));
};

const getChallengeElement = container => {
  return container.getElementsByClassName('challenges')[0];
};

const getChallengeInfos = challengeContainerElement => {
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

const getPromisedStorageKeys = keys => {
  return new Promise(resolve => {
    chrome.storage.sync.get(keys, resolve);
  });
};

const teamSpec = (teams, operator) => ({
  isSatisfied: compareTeams(teams, operator),
});

const sum = (a, b) => a + b;
const sumArray = arr => arr.reduce(sum, 0);

const extractNumEncounters = html => {
  const div = document.createElement('div');
  div.innerHTML = html;

  const scores = Array.from(div.querySelectorAll('.upt__score strong')).map(v => parseFloat(v.innerHTML));

  return sumArray(scores);
};

const encounterSpec = (value, operator) => ({
  isSatisfied: async challenge => {
    const response = await HTTP.get(`/@/${challenge.username}/mini`);
    const encounters = extractNumEncounters(response.data);

    return compare(operator, value)(encounters);
  },
});

const compare = (relation, value) => candidate => {
  switch (relation) {
    case 'LT':
      return value > candidate;
    case 'GT':
      return value < candidate;
    case 'LTE':
      return value >= candidate;
    case 'GTE':
      return value <= candidate;
    case 'IN':
      if (!Array.isArray(value)) {
        return value.split(';').includes(candidate);
      }
      return value.includes(candidate);
    case 'NEQ':
      return value !== candidate;
    case 'NIN':
      if (!Array.isArray(value)) {
        return !value.split(';').includes(candidate);
      }
      return !value.includes(candidate);
    case 'EQ':
    default:
      return value === candidate;
  }
};

const getLichessPrefs = () =>
  new Promise((resolve, reject) => {
    getPromisedStorageKeys(['lichessTeamRules']).then(result => {
      if (result.lichessTeamRules) {
        resolve(JSON.parse(result.lichessTeamRules));
      } else {
        reject(new Error('no prefs found'));
      }
    });
  });

const applyCondition = (operator, spec1, spec2) => {
  switch (operator) {
    case 'AND':
      return andSpec(spec1, spec2);
    case 'OR':
    default:
      return orSpec(spec1, spec2);
  }
};

const mapOperator = operator => {
  switch (operator) {
    case 'less':
      return 'LT';
    case 'less_or_equal':
      return 'LTE';
    case 'greater':
      return 'GT';
    case 'greater_or_equal':
      return 'GTE';
    case 'equal':
      return 'EQ';
    case 'not_equal':
      return 'NEQ';
    case 'not_in':
      return 'NIN';
    case 'in':
      return 'IN';
  }
};

const getSpec = rule => {
  if (typeof rule.condition !== 'undefined') {
    const operator = rule.condition;
    return rule.rules.reduce((currentSpec, currentRule) => {
      return applyCondition(operator, currentSpec, getSpec(currentRule));
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

export default {
  props: {
    container: {
      type: HTMLElement,
    },
  },
  computed: {
    specs() {
      return this.$store.getters.specs;
    },
  },
  methods: {
    async team() {
      const challengeElement = getChallengeElement(this.container);
      if (!challengeElement) {
        console.log('No matching challenge found');
        return;
      }

      try {
        const lichessPrefs = await getLichessPrefs();

        const spec = getSpec(lichessPrefs);
        const challengeInfo = getChallengeInfos(challengeElement);
        const challenge = await processChallenges(challengeInfo, spec);
        if (challenge) {
          challenge.accept();
        } else {
          console.log('No matching challenge found');
        }
      } catch (e) {
        console.error(e);
      }
    },
  },
};
</script>
<style>
.extender {
  background-color: #fff;
}

.extender button {
  width: 100%;
  padding: 15px 0;
}
</style>
