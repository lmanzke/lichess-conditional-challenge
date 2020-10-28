<template>
  <div class="extender">
    <button class="fbt" @click="team">Accept matching challenge</button>
    <button class="fbt" @click="declineAll">Decline all unmatching</button>
  </div>
</template>

<script>
import { convertRule, declineUnmatchingFactory, getChallengeElement, getChallengeInfos, processChallengesFactory } from './lichess';
import { getLichessPrefs } from './storage';

export default {
  props: {
    container: {
      type: HTMLElement,
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
        const spec = convertRule(lichessPrefs);

        const challengeInfo = await getChallengeInfos(challengeElement);
        const challengeProcessor = processChallengesFactory(spec);
        const matchingChallenges = await challengeProcessor(challengeInfo);

        if (matchingChallenges.length > 0) {
          matchingChallenges[0].accept();
        } else {
          console.log('No matching challenge found');
        }
      } catch (e) {
        console.error(e);
      }
    },
    async declineAll() {
      const challengeElement = getChallengeElement(this.container);
      if (!challengeElement) {
        return;
      }

      try {
        const lichessPrefs = await getLichessPrefs();
        const spec = convertRule(lichessPrefs);

        const challengeInfo = await getChallengeInfos(challengeElement);
        const challengeProcessor = declineUnmatchingFactory(spec);
        const unmatchedChallenges = await challengeProcessor(challengeInfo);

        unmatchedChallenges.forEach(challenge => challenge.decline());
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
