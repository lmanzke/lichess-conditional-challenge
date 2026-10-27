<template>
  <div class="options-container">
    <div v-if="state && current" class="profiles">
      <label>
        Profile
        <select v-model="currentId">
          <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id">{{ profile.name }}{{ profile.id === state.activeId ? ' (active)' : '' }}</option>
        </select>
      </label>
      <label>
        Name
        <input v-model="current.name" type="text" />
      </label>
      <button type="button" :disabled="current.id === state.activeId" @click="state.activeId = current.id">Use this profile</button>
      <button type="button" @click="add">New</button>
      <button type="button" @click="duplicate">Duplicate</button>
      <button type="button" class="danger" :disabled="state.profiles.length < 2" @click="remove">Delete</button>
    </div>

    <RuleNode v-if="current" :key="current.id" :node="current.rules" root />

    <div class="actions">
      <button type="button" class="primary" @click="save">Save</button>
      <button type="button" class="danger" @click="reset">Reset profile</button>
      <span v-if="saved" class="saved">Saved</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { defaultRules, loadProfiles, newProfile, saveProfiles, type ProfileState } from '@/challenge/profiles';
import RuleNode from './RuleNode.vue';

const state = ref<ProfileState>();
const currentId = ref('');
const saved = ref(false);

// Rules saved by earlier versions carry additional fields (like `valid`), which are simply kept.
const current = computed(() => state.value?.profiles.find(profile => profile.id === currentId.value));

onMounted(async () => {
  state.value = await loadProfiles(chrome.storage.sync);
  currentId.value = state.value.activeId;
});

function add() {
  const profile = newProfile('New profile');
  state.value?.profiles.push(profile);
  currentId.value = profile.id;
}

function duplicate() {
  if (!current.value) return;
  const profile = newProfile(`${current.value.name} (copy)`, JSON.parse(JSON.stringify(current.value.rules)));
  state.value?.profiles.push(profile);
  currentId.value = profile.id;
}

function remove() {
  if (!state.value || !current.value || state.value.profiles.length < 2) return;
  if (!confirm(`Delete the profile "${current.value.name}"?`)) return;

  state.value.profiles = state.value.profiles.filter(profile => profile.id !== currentId.value);
  if (state.value.activeId === currentId.value) state.value.activeId = state.value.profiles[0].id;
  currentId.value = state.value.activeId;
}

async function save() {
  if (!state.value) return;
  // Blank names would make the profile impossible to tell apart in the lichess menu.
  state.value.profiles.forEach((profile, index) => (profile.name = profile.name.trim() || `Profile ${index + 1}`));
  await saveProfiles(chrome.storage.sync, JSON.parse(JSON.stringify(state.value)));
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}

async function reset() {
  if (!current.value) return;
  current.value.rules = defaultRules();
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
