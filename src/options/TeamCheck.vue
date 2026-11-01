<template>
  <ul v-if="entries.length > 0" class="team-checks" aria-live="polite">
    <li v-for="entry in entries" :key="entry.input" :class="kind(entry)">
      <template v-if="entry.state === 'checking'"
        ><span class="muted">{{ t('team.checking') }}</span></template
      >
      <template v-else-if="entry.check?.suggestion">
        <AppIcon name="warning" />
        <span>{{ t('team.suggest', { id: entry.check.suggestion.id, name: entry.check.suggestion.name }) }}</span>
        <button type="button" class="ghost small" @click="emit('replace', entry.input, entry.check.suggestion.id)">{{ t('team.use') }}</button>
      </template>
      <template v-else-if="entry.check?.result.status === 'found'">
        <AppIcon name="check" />
        <span>{{ t('team.found', { name: entry.check.result.name, count: entry.check.result.members }) }}</span>
      </template>
      <template v-else-if="entry.check?.result.status === 'missing'">
        <AppIcon name="warning" />
        <span>{{ t('team.missing', { id: entry.input }) }}</span>
      </template>
      <template v-else>
        <AppIcon name="warning" />
        <span>{{ t('team.unknown', { id: entry.input }) }}</span>
      </template>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { TeamCheck } from '@/challenge/teams';
import AppIcon from './AppIcon.vue';
import { checkTeam } from './lichess';

interface Entry {
  input: string;
  state: 'checking' | 'done';
  check?: TeamCheck;
}

const props = defineProps<{ value: string }>();
const emit = defineEmits<{ replace: [from: string, to: string] }>();
const { t } = useI18n();

const DEBOUNCE_MS = 600;
const MAX_TEAMS = 10;

const entries = ref<Entry[]>([]);

const kind = (entry: Entry) => (entry.state === 'checking' ? 'pending' : !entry.check?.suggestion && entry.check?.result.status === 'found' ? 'ok' : 'warn');
let timer: ReturnType<typeof setTimeout> | undefined;
let generation = 0;

// Rules accept several teams separated by ';'. Typing is debounced so that not every keystroke asks lichess.
const check = (value: string) => {
  const mine = ++generation;
  const inputs = [
    ...new Set(
      value
        .split(';')
        .map(part => part.trim())
        .filter(part => part !== '')
    ),
  ].slice(0, MAX_TEAMS);
  entries.value = inputs.map(input => entries.value.find(entry => entry.input === input && entry.state === 'done') ?? { input, state: 'checking' });

  inputs.forEach(async input => {
    if (entries.value.some(entry => entry.input === input && entry.state === 'done')) return;
    const result = await checkTeam(input);
    if (mine === generation) {
      entries.value = entries.value.map(entry => (entry.input === input ? { input, state: 'done', check: result } : entry));
    }
  });
};

watch(
  () => props.value,
  value => {
    clearTimeout(timer);
    timer = setTimeout(() => check(value), DEBOUNCE_MS);
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  clearTimeout(timer);
  generation++;
});
</script>

<style>
.team-checks {
  list-style: none;
  margin: 6px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 0.88rem;
}

.team-checks li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.team-checks li.ok {
  color: var(--ok);
}

.team-checks li.warn {
  color: var(--warn);
}

.team-checks li.pending {
  color: var(--muted);
}

button.small {
  min-height: 26px;
  padding: 2px 8px;
}
</style>
