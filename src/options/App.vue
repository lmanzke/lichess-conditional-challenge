<template>
  <main class="page">
    <header class="page-header">
      <h1>{{ t('page.title') }}</h1>
      <p class="intro">{{ t('page.intro') }}</p>
    </header>

    <section v-if="state && current" class="card profile-card" aria-labelledby="profile-heading">
      <h2 id="profile-heading" class="sr-only">{{ t('profile.label') }}</h2>
      <div class="profile-main">
        <label class="field">
          <span class="label">{{ t('profile.label') }}</span>
          <select v-model="currentId">
            <option v-for="profile in state.profiles" :key="profile.id" :value="profile.id">
              {{ profile.name }}{{ profile.id === state.activeId ? ` (${t('profile.active')})` : '' }}
            </option>
          </select>
        </label>
        <label class="field grow">
          <span class="label">{{ t('profile.name') }}</span>
          <input type="text" :value="current.name" @input="updateCurrent(p => ({ ...p, name: ($event.target as HTMLInputElement).value }))" />
        </label>
        <span v-if="current.id === state.activeId" class="badge"><AppIcon name="check" />{{ t('profile.active') }}</span>
        <button v-else type="button" class="primary" @click="state = { ...state, activeId: current.id }">{{ t('profile.use') }}</button>
      </div>
      <div class="toolbar">
        <button type="button" class="ghost" @click="add"><AppIcon name="plus" />{{ t('profile.new') }}</button>
        <button type="button" class="ghost" @click="duplicate"><AppIcon name="copy" />{{ t('profile.duplicate') }}</button>
        <button type="button" class="ghost" @click="exportAll"><AppIcon name="download" />{{ t('profile.export') }}</button>
        <button type="button" class="ghost" @click="fileInput?.click()"><AppIcon name="upload" />{{ t('profile.import') }}</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
        <span class="spacer"></span>
        <button type="button" class="icon danger" :disabled="state.profiles.length < 2" :aria-label="t('profile.delete')" :title="t('profile.delete')" @click="remove">
          <AppIcon name="trash" />
        </button>
      </div>
      <p v-if="importMessage" class="import-message" :class="{ warning: importFailed }" role="status">{{ importMessage }}</p>
    </section>

    <section v-if="current" class="card" aria-labelledby="rules-heading">
      <h2 id="rules-heading">{{ t('rules.title', { name: current.name }) }}</h2>
      <RuleNode :key="current.id" :node="current.rules" root @change="setRules" />
    </section>

    <section v-if="current" class="card preview" aria-labelledby="preview-heading">
      <h2 id="preview-heading">{{ t('rules.preview') }}</h2>
      <p class="muted">{{ t('rules.previewHint') }}</p>
      <pre>{{ describeRule(current.rules, t) }}</pre>
    </section>

    <div class="actions savebar">
      <span v-if="dirty" class="status dirty"><span class="dot"></span>{{ t('status.unsaved') }}</span>
      <span v-if="issueCount > 0" class="warning" role="status"><AppIcon name="warning" />{{ t('issues.summary', { count: issueCount }, issueCount) }}</span>
      <span class="spacer"></span>
      <button type="button" class="danger ghost" @click="reset">{{ t('profile.reset') }}</button>
      <button type="button" class="primary" @click="save">{{ t('profile.save') }}</button>
    </div>

    <Transition name="toast">
      <div v-if="saved" class="toast saved" role="status"><AppIcon name="check" />{{ t('profile.saved') }}</div>
    </Transition>
  </main>
</template>

<script setup lang="ts">
import { Effect, Optic, Option } from 'effect';
import { useI18n } from 'vue-i18n';
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { defaultRules, exportProfiles, loadProfiles, newProfile, parseImport, resolveActiveId, saveProfiles, type Profile, type ProfileState } from '@/challenge/profiles';
import type { Rule } from '@/challenge/types';
import { countIssues, describeRule } from './filters';
import AppIcon from './AppIcon.vue';
import RuleNode from './RuleNode.vue';

const { t } = useI18n();

// The state is immutable, so every edit replaces it; a shallow ref is enough to notice that.
const state = shallowRef<ProfileState>();
const currentId = ref('');
const saved = ref(false);
const fileInput = ref<HTMLInputElement>();
const importMessage = ref('');
const importFailed = ref(false);
// The active profile when the page was loaded or last saved, to tell if it was changed here.
let loadedActiveId = '';
// What is in storage, to tell if there is anything to save.
const savedSnapshot = ref('');
const dirty = computed(() => state.value !== undefined && JSON.stringify(state.value) !== savedSnapshot.value);
const warnOnLeave = (event: BeforeUnloadEvent) => {
  if (dirty.value) event.preventDefault();
};

const rulesLens = Optic.id<Profile>().key('rules');

const issueCount = computed(() => (state.value ? state.value.profiles.reduce((sum, profile) => sum + countIssues(profile.rules), 0) : 0));
const current = computed(() => state.value?.profiles.find(profile => profile.id === currentId.value));

onMounted(async () => {
  state.value = await Effect.runPromise(loadProfiles(chrome.storage.sync));
  currentId.value = state.value.activeId;
  loadedActiveId = state.value.activeId;
  savedSnapshot.value = JSON.stringify(state.value);
  window.addEventListener('beforeunload', warnOnLeave);
});

onBeforeUnmount(() => window.removeEventListener('beforeunload', warnOnLeave));

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

function exportAll() {
  if (!state.value) return;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([exportProfiles(state.value.profiles)], { type: 'application/json' }));
  link.download = 'lichess-challenge-profiles.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

const MAX_IMPORT_BYTES = 1_000_000;

// Imported profiles are added to the existing ones and, like every other edit, only stored on "Save".
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !state.value) return;

  const imported = file.size <= MAX_IMPORT_BYTES ? parseImport(await file.text()) : Option.none();
  importFailed.value = Option.isNone(imported);
  if (Option.isNone(imported)) {
    importMessage.value = t('profile.importFailed');
    return;
  }

  state.value = { ...state.value, profiles: [...state.value.profiles, ...imported.value] };
  currentId.value = imported.value[0].id;
  importMessage.value = t('profile.imported', { count: imported.value.length }, imported.value.length);
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
  savedSnapshot.value = JSON.stringify(state.value);
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}

async function reset() {
  setRules(defaultRules());
  await save();
}
</script>

<style>
.page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 24px 20px 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header h1 {
  margin: 0 0 4px;
  font-size: 1.6rem;
}

.intro,
.muted {
  margin: 0;
  color: var(--muted);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--shadow);
}

.card h2 {
  margin: 0 0 12px;
  font-size: 1.1rem;
}

.profile-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.profile-main {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field.grow {
  flex: 1;
  min-width: 180px;
}

.label {
  font-size: 0.8rem;
  color: var(--muted);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--ok) 16%, transparent);
  color: var(--ok);
  font-weight: 600;
  text-transform: capitalize;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.spacer {
  flex: 1;
}

.preview pre {
  margin: 8px 0 0;
  padding: 12px;
  overflow: auto;
  font:
    0.9rem/1.5 ui-monospace,
    SFMono-Regular,
    Menlo,
    monospace;
  background: var(--surface-2);
  border-radius: 8px;
}

.savebar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin: 0 -20px;
  padding: 12px 20px;
  background: color-mix(in srgb, var(--bg) 88%, transparent);
  backdrop-filter: blur(8px);
  border-top: 1px solid var(--border);
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warn);
}

.toast {
  position: fixed;
  right: 24px;
  bottom: 84px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  background: var(--ok);
  color: var(--accent-contrast);
  font-weight: 600;
  box-shadow: var(--shadow);
}

.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
