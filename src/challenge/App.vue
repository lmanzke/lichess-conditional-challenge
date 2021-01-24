<template>
  <div class="extender">
    <button class="fbt" @click="acceptMatchingClicked">Accept matching challenge</button>
    <button class="fbt" @click="declineUnmatchingClicked">Decline all unmatching</button>
  </div>
</template>

<script lang="ts">
import { ChallengeRetriever, declineUnmatchingFactory, getChallengeElement, processChallengesFactory, RuleConverter } from '@/challenge/lichess';
import { getLichessPrefs } from '@/challenge/storage';
import { defineComponent, provide } from 'vue';
import { JpexInstance } from 'jpex';

interface Props {
  container: HTMLElement;
  dependencies: JpexInstance;
}

const acceptMatchingClicked = (container: HTMLElement, convertRule: RuleConverter, challengeRetriever: ChallengeRetriever) => async () => {
  const challengeElement = getChallengeElement(container);
  if (!challengeElement) {
    console.log('No matching challenge found');
    return;
  }

  try {
    const lichessPrefs = await getLichessPrefs();
    const spec = convertRule(lichessPrefs);

    const challengeInfo = await challengeRetriever(challengeElement);
    const challengeProcessor = processChallengesFactory(spec);
    const matchingChallenges = await challengeProcessor(challengeInfo, []);

    if (matchingChallenges.length > 0) {
      matchingChallenges[0].challenge.accept();
    } else {
      console.log('No matching challenge found');
    }
  } catch (e) {
    console.error(e);
  }
};

const declineUnmatchingClicked = (container: HTMLElement, convertRule: RuleConverter, challengeRetriever: ChallengeRetriever) => async () => {
  const challengeElement = getChallengeElement(container);
  if (!challengeElement) {
    return;
  }

  try {
    const lichessPrefs = await getLichessPrefs();
    const spec = convertRule(lichessPrefs);

    const challengeInfo = await challengeRetriever(challengeElement);
    const challengeProcessor = declineUnmatchingFactory(spec);
    const unmatchedChallenges = await challengeProcessor(challengeInfo, []);

    unmatchedChallenges.forEach(challengeInfo => {
      if (!challengeInfo.silent) {
        challengeInfo.challenge.decline();
      }
    });
  } catch (e) {
    console.error(e);
  }
};

export default defineComponent({
  props: {
    container: {
      type: HTMLElement,
    },
    dependencies: {
      type: Object,
    },
  },
  setup(props: Props) {
    provide('dependencies', props.dependencies);
    const ruleConverter = props.dependencies.resolve<RuleConverter>('ruleConverter');
    const challengeRetriever = props.dependencies.resolve<ChallengeRetriever>('challengeRetriever');

    return {
      acceptMatchingClicked: acceptMatchingClicked(props.container, ruleConverter, challengeRetriever),
      declineUnmatchingClicked: declineUnmatchingClicked(props.container, ruleConverter, challengeRetriever),
    };
  },
});
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
