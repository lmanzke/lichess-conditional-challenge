<template>
  <div class="options-container">
    <RuleNode v-if="rules" :node="rules" root />
    <div class="actions">
      <button type="button" class="primary" @click="save">Save</button>
      <button type="button" class="danger" @click="reset">Reset</button>
      <span v-if="saved" class="saved">Saved</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { Rule } from '@/challenge/types';
import { RULES_KEY } from '@/challenge/storage';
import RuleNode from './RuleNode.vue';
import { defaultRules } from './filters';

const rules = ref<Rule>();
const saved = ref(false);

onMounted(async () => {
  const stored = (await chrome.storage.sync.get(RULES_KEY))[RULES_KEY];
  // Rules saved by earlier versions carry additional fields (like `valid`), which are simply kept.
  rules.value = typeof stored === 'string' && stored !== '' ? JSON.parse(stored) : defaultRules();
});

async function save() {
  await chrome.storage.sync.set({ [RULES_KEY]: JSON.stringify(rules.value) });
  saved.value = true;
  setTimeout(() => (saved.value = false), 2000);
}

async function reset() {
  rules.value = defaultRules();
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
