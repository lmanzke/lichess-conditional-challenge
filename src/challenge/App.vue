<template>
  <div class="extender">
    <label v-if="state && state.profiles.length > 1" class="profile">
      Profile
      <select :value="state.activeId" @change="select(($event.target as HTMLSelectElement).value)">
        <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id" :title="describeRule(profile.rules)">{{ profile.name }}</option>
      </select>
      <span class="info" tabindex="0" aria-label="Rules of this profile">
        ⓘ
        <pre class="tooltip">{{ describeRule(getActiveProfile(state).rules) }}</pre>
      </span>
    </label>
    <button @click="run(acceptMatchingChallenge(container))">Accept matching challenge</button>
    <button @click="run(declineUnmatchingChallenges(container))">Decline all unmatching</button>
    <button v-if="devMode" @click="run(logInfo(container))">Log info</button>
  </div>
</template>

<script setup lang="ts">
import { Effect } from 'effect';
import type { Lichess } from '@/challenge/lichess-api';
import { acceptMatchingChallenge, declineUnmatchingChallenges, logInfo } from '@/challenge/actions';
import { getActiveProfile } from '@/challenge/profiles';
import { useProfiles } from '@/challenge/useProfiles';
import { describeRule } from '@/options/filters';

const props = defineProps<{
  container: HTMLElement;
  runEffect: <A>(effect: Effect.Effect<A, Error, Lichess>) => Promise<A>;
}>();

const devMode = import.meta.env.DEV;
const { state, select } = useProfiles();

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

.extender .profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  color: #777777;
  text-transform: uppercase;
}

.extender .profile select {
  flex: 1;
  min-width: 0;
}

.extender .info {
  position: relative;
  cursor: help;
}

.extender .tooltip {
  display: none;
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 1;
  margin: 4px 0 0;
  padding: 8px 12px;
  white-space: pre;
  text-transform: none;
  font: inherit;
  color: #333;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  box-shadow: 0 2px 8px #0003;
}

.extender .info:hover .tooltip,
.extender .info:focus .tooltip {
  display: block;
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
