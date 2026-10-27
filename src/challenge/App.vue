<template>
  <div class="extender">
    <label v-if="state && state.profiles.length > 1" class="profile">
      {{ t('profile.label') }}
      <select :value="state.activeId" @change="select(($event.target as HTMLSelectElement).value)">
        <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id" :title="describeRule(profile.rules, t)">{{ profile.name }}</option>
      </select>
      <span class="info" tabindex="0" :aria-label="t('profile.rulesInfo')">
        ⓘ
        <pre class="tooltip">{{ describeRule(getActiveProfile(state).rules, t) }}</pre>
      </span>
    </label>
    <button :disabled="busy" @click="run(acceptMatchingChallenge(container))">{{ t('challenge.acceptMatching') }}</button>
    <button :disabled="busy" @click="declineAll">{{ t('challenge.declineUnmatching') }}</button>
    <button v-if="devMode" @click="logInfoClicked">Log info</button>
    <p v-if="status" class="status" :class="{ error: status.error }" role="status">{{ status.text }}</p>
  </div>
</template>

<script setup lang="ts">
import { Effect } from 'effect';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Lichess } from '@/challenge/lichess-api';
import { acceptMatchingChallenge, declineUnmatchingChallenges, logInfo, NoMatchingChallenge, type ActionResult } from '@/challenge/actions';
import { getActiveProfile } from '@/challenge/profiles';
import { useProfiles } from '@/challenge/useProfiles';
import { describeRule } from '@/options/filters';

const props = defineProps<{
  container: HTMLElement;
  runEffect: <A>(effect: Effect.Effect<A, Error, Lichess>) => Promise<A>;
}>();

const { t } = useI18n();
const devMode = import.meta.env.DEV;
const { state, select } = useProfiles();

const busy = ref(false);
const status = ref<{ text: string; error: boolean }>();
let clearStatus: ReturnType<typeof setTimeout> | undefined;

const show = (text: string, error = false) => {
  status.value = { text, error };
  clearTimeout(clearStatus);
  clearStatus = setTimeout(() => (status.value = undefined), 8000);
};

const describeResult = (result: ActionResult) => (result.kind === 'accepted' ? t('challenge.accepted') : t('challenge.declined', { count: result.count }, result.count));

const describeError = (error: unknown) => {
  if (error instanceof NoMatchingChallenge) return t('challenge.noMatch');
  console.error(error);
  return t('challenge.failed', { reason: error instanceof Error ? error.message : String(error) });
};

const run = async (effect: Effect.Effect<ActionResult, Error, Lichess>) => {
  busy.value = true;
  try {
    show(describeResult(await props.runEffect(effect)));
  } catch (error) {
    show(describeError(error), !(error instanceof NoMatchingChallenge));
  } finally {
    busy.value = false;
  }
};

// Declining cannot be undone, so it has to be confirmed.
const declineAll = () => {
  if (confirm(t('challenge.confirmDecline'))) void run(declineUnmatchingChallenges(props.container));
};

const logInfoClicked = () => void props.runEffect(logInfo(props.container)).then(console.log, console.error);
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

.extender .status {
  margin: 0;
  padding: 8px 12px;
  color: #4a7c1f;
  font-size: 0.9em;
}

.extender .status.error {
  color: #c0392b;
}

.extender button:disabled {
  opacity: 0.5;
  cursor: progress;
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
