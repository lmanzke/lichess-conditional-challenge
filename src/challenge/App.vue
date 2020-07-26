<template>
  <div class="extender">
    <button class="fbt" @click="team">Apply extension preferences</button>
  </div>
</template>

<script>
import { convertRule, getChallengeElement, getChallengeInfos, processChallenges } from './lichess';
import { getLichessPrefs } from './storage';

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
        const spec = convertRule(lichessPrefs);
        console.log(lichessPrefs, spec);

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
