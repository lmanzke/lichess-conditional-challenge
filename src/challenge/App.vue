<template>
  <div class="extender">
    <button @click="run(acceptMatchingChallenge(container))">Accept matching challenge</button>
    <button @click="run(declineUnmatchingChallenges(container))">Decline all unmatching</button>
    <button v-if="devMode" @click="run(logInfo(container))">Log info</button>
  </div>
</template>

<script setup lang="ts">
import { Effect } from 'effect';
import type { Lichess } from '@/challenge/lichess-api';
import { acceptMatchingChallenge, declineUnmatchingChallenges, logInfo } from '@/challenge/actions';

const props = defineProps<{
  container: HTMLElement;
  runEffect: <A>(effect: Effect.Effect<A, Error, Lichess>) => Promise<A>;
}>();

const devMode = import.meta.env.DEV;

const run = (effect: Effect.Effect<unknown, Error, Lichess>) =>
  props
    .runEffect(effect)
    .then(result => console.log(result))
    .catch((error: unknown) => console.log(error instanceof Error ? error.message : error));
</script>

<style>
.extender {
  background-color: #fff;
}

.extender button {
  width: 100%;
  padding: 12px 0;
  margin: 1px 1px 0 1px;
  text-transform: uppercase;
  line-height: 1.5;
  transition: all 150ms;
  background: none;
  border: none;
  outline: none;
  color: #777777 !important;

  &:hover {
    background: #89b25b;
    color: #fff !important;
  }
}
</style>
