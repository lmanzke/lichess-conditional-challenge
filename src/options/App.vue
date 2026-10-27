<template>
  <div class="options-container">
    <div v-if="state && current" class="profiles">
      <label>
        {{ t('profile.label') }}
        <select v-model="currentId">
          <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id" :title="describeRule(profile.rules, t)">
            {{ profile.name }}{{ profile.id === state.activeId ? ` (${t('profile.active')})` : '' }}
          </option>
        </select>
      </label>
      <span class="info" tabindex="0" :aria-label="t('profile.rulesInfo')">
        ⓘ
        <pre class="tooltip">{{ describeRule(current.rules, t) }}</pre>
      </span>
      <label>
        {{ t('profile.name') }}
        <input type="text" :value="current.name" @input="updateCurrent(p => ({ ...p, name: ($event.target as HTMLInputElement).value }))" />
      </label>
      <button type="button" :disabled="current.id === state.activeId" @click="state = { ...state, activeId: current.id }">{{ t('profile.use') }}</button>
      <button type="button" @click="add">{{ t('profile.new') }}</button>
      <button type="button" @click="duplicate">{{ t('profile.duplicate') }}</button>
      <button type="button" class="danger" :disabled="state.profiles.length < 2" @click="remove">{{ t('profile.delete') }}</button>
    </div>

    <RuleNode v-if="current" :key="current.id" :node="current.rules" root @change="setRules" />

    <div class="actions">
      <button type="button" class="primary" @click="save">{{ t('profile.save') }}</button>
      <button type="button" class="danger" @click="reset">{{ t('profile.reset') }}</button>
      <span v-if="saved" class="saved">{{ t('profile.saved') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Effect, Optic } from 'effect';
import { useI18n } from 'vue-i18n';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { defaultRules, loadProfiles, newProfile, resolveActiveId, saveProfiles, type Profile, type ProfileState } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';
import { describeRule } from './filters';
import RuleNode from './RuleNode.vue';

const { t } = useI18n();

// The state is immutable, so every edit replaces it; a shallow ref is enough to notice that.
const state = shallowRef<ProfileState>();
const currentId = ref('');
const saved = ref(false);
// The active profile when the page was loaded or last saved, to tell if it was changed here.
let loadedActiveId = '';

const rulesLens = Optic.id<Profile>().key('rules');

const current = computed(() => state.value?.profiles.find(profile => profile.id === currentId.value));

onMounted(async () => {
  state.value = await Effect.runPromise(loadProfiles(chrome.storage.sync));
  currentId.value = state.value.activeId;
  loadedActiveId = state.value.activeId;
});

function updateCurrent(f: (profile: Profile) => Profile) {
  if (!state.value) return;
  state.value = { ...state.value, profiles: state.value.profiles.map(profile => (profile.id === currentId.value ? f(profile) : profile)) };
}

const setRules = (rules: Rule) => updateCurrent(Optic.replace(rulesLens, rules));

function add() {
  if (!state.value) return;
  const profile = newProfile(t('profile.defaultName'));
  state.value = { ...state.value, profiles: [...state.value.profiles, profile] };
  currentId.value = profile.id;
}

function duplicate() {
  if (!state.value || !current.value) return;
  const profile = newProfile(t('profile.copyOf', { name: current.value.name }), current.value.rules);
  state.value = { ...state.value, profiles: [...state.value.profiles, profile] };
  currentId.value = profile.id;
}

function remove() {
  if (!state.value || !current.value || state.value.profiles.length < 2) return;
  if (!confirm(t('profile.deleteConfirm', { name: current.value.name }))) return;

  const profiles = state.value.profiles.filter(profile => profile.id !== currentId.value);
  const activeId = state.value.activeId === currentId.value ? profiles[0].id : state.value.activeId;
  state.value = { activeId, profiles };
  currentId.value = activeId;
}

async function save() {
  if (!state.value) return;
  // Blank names would make the profile impossible to tell apart in the lichess menu.
  state.value = { ...state.value, profiles: state.value.profiles.map((profile, index) => ({ ...profile, name: profile.name.trim() || t('profile.unnamed', { n: index + 1 }) })) };
  const stored = await Effect.runPromise(loadProfiles(chrome.storage.sync));
  const activeId = resolveActiveId({ loaded: loadedActiveId, local: state.value.activeId, stored: stored.activeId, ids: state.value.profiles.map(profile => profile.id) });
  state.value = { ...state.value, activeId };
  await Effect.runPromise(saveProfiles(chrome.storage.sync, state.value));
  loadedActiveId = activeId;
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}

async function reset() {
  setRules(defaultRules());
  await save();
}
</script>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

.options-container {
  padding: 20px;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.group {
  border: 1px solid #8884;
  border-radius: 6px;
  padding: 8px;
  background: #8881;
}

.profiles {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
}

.info {
  position: relative;
  cursor: help;
}

.tooltip {
  display: none;
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1;
  margin: 4px 0 0;
  padding: 8px 12px;
  white-space: pre;
  font: inherit;
  background: Canvas;
  border: 1px solid #8886;
  border-radius: 6px;
  box-shadow: 0 2px 8px #0003;
}

.info:hover .tooltip,
.info:focus .tooltip {
  display: block;
}

.group-header,
.rule {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
  padding-left: 16px;
}

.rule {
  padding: 6px;
  border: 1px solid #8883;
  border-radius: 4px;
}

.choices {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

button {
  padding: 4px 10px;
  cursor: pointer;
}

button.primary {
  background: #3b7ddd;
  color: #fff;
  border: 1px solid #3b7ddd;
  border-radius: 4px;
}

button.danger {
  color: #c0392b;
}

.saved {
  color: #2e8b57;
}
</style>
