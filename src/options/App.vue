<template>
  <div class="options-container">
    <div v-if="state && current" class="profiles">
      <label>
        Profile
        <select v-model="currentId">
          <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id" :title="describeRule(profile.rules)">
            {{ profile.name }}{{ profile.id === state.activeId ? ' (active)' : '' }}
          </option>
        </select>
      </label>
      <span class="info" tabindex="0" aria-label="Rules of this profile">
        ⓘ
        <pre class="tooltip">{{ describeRule(current.rules) }}</pre>
      </span>
      <label>
        Name
        <input type="text" :value="current.name" @input="updateCurrent(p => ({ ...p, name: ($event.target as HTMLInputElement).value }))" />
      </label>
      <button type="button" :disabled="current.id === state.activeId" @click="state = { ...state, activeId: current.id }">Use this profile</button>
      <button type="button" @click="add">New</button>
      <button type="button" @click="duplicate">Duplicate</button>
      <button type="button" class="danger" :disabled="state.profiles.length < 2" @click="remove">Delete</button>
    </div>

    <RuleNode v-if="current" :key="current.id" :node="current.rules" root @change="setRules" />

    <div class="actions">
      <button type="button" class="primary" @click="save">Save</button>
      <button type="button" class="danger" @click="reset">Reset profile</button>
      <span v-if="saved" class="saved">Saved</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Effect, Optic } from 'effect';
import { computed, onMounted, ref, shallowRef } from 'vue';
import { defaultRules, loadProfiles, newProfile, saveProfiles, type Profile, type ProfileState } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';
import { describeRule } from './filters';
import RuleNode from './RuleNode.vue';

// The state is immutable, so every edit replaces it; a shallow ref is enough to notice that.
const state = shallowRef<ProfileState>();
const currentId = ref('');
const saved = ref(false);

const rulesLens = Optic.id<Profile>().key('rules');

const current = computed(() => state.value?.profiles.find(profile => profile.id === currentId.value));

onMounted(async () => {
  state.value = await Effect.runPromise(loadProfiles(chrome.storage.sync));
  currentId.value = state.value.activeId;
});

function updateCurrent(f: (profile: Profile) => Profile) {
  if (!state.value) return;
  state.value = { ...state.value, profiles: state.value.profiles.map(profile => (profile.id === currentId.value ? f(profile) : profile)) };
}

const setRules = (rules: Rule) => updateCurrent(Optic.replace(rulesLens, rules));

function add() {
  if (!state.value) return;
  const profile = newProfile('New profile');
  state.value = { ...state.value, profiles: [...state.value.profiles, profile] };
  currentId.value = profile.id;
}

function duplicate() {
  if (!state.value || !current.value) return;
  const profile = newProfile(`${current.value.name} (copy)`, current.value.rules);
  state.value = { ...state.value, profiles: [...state.value.profiles, profile] };
  currentId.value = profile.id;
}

function remove() {
  if (!state.value || !current.value || state.value.profiles.length < 2) return;
  if (!confirm(`Delete the profile "${current.value.name}"?`)) return;

  const profiles = state.value.profiles.filter(profile => profile.id !== currentId.value);
  const activeId = state.value.activeId === currentId.value ? profiles[0].id : state.value.activeId;
  state.value = { activeId, profiles };
  currentId.value = activeId;
}

async function save() {
  if (!state.value) return;
  // Blank names would make the profile impossible to tell apart in the lichess menu.
  state.value = { ...state.value, profiles: state.value.profiles.map((profile, index) => ({ ...profile, name: profile.name.trim() || `Profile ${index + 1}` })) };
  await Effect.runPromise(saveProfiles(chrome.storage.sync, state.value));
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
