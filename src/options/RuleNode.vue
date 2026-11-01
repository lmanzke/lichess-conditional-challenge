<template>
  <div v-if="isGroup" class="group" :style="{ '--group-color': `var(--depth-${depth % 4})` }">
    <div class="group-header">
      <select class="pill" :value="node.condition" :aria-label="t('rule.condition')" @change="update({ condition: ($event.target as HTMLSelectElement).value })">
        <option value="AND">{{ t('rule.conditions.AND') }}</option>
        <option value="OR">{{ t('rule.conditions.OR') }}</option>
      </select>
      <button type="button" class="ghost" @click="update({ rules: [...node.rules, newRule()] })"><AppIcon name="plus" />{{ t('rule.addRule') }}</button>
      <button type="button" class="ghost" @click="update({ rules: [...node.rules, newGroup()] })"><AppIcon name="group" />{{ t('rule.addGroup') }}</button>
      <span class="spacer"></span>
      <button v-if="!root" type="button" class="icon danger" :aria-label="t('rule.deleteGroup')" :title="t('rule.deleteGroup')" @click="emit('remove')">
        <AppIcon name="trash" />
      </button>
    </div>
    <p v-if="issue" class="warning" role="alert"><AppIcon name="warning" />{{ t(`issues.${issue}`) }}</p>
    <div class="group-body">
      <RuleNode
        v-for="(child, index) in node.rules"
        :key="index"
        :node="child"
        :depth="depth + 1"
        @change="next => emit('change', replaceChild(index, next))"
        @remove="update({ rules: node.rules.filter((_, i) => i !== index) })"
      />
    </div>
  </div>

  <div v-else class="rule" :class="{ invalid: issue }">
    <select class="rule-field" :value="node.id" :aria-label="t('rule.field')" @change="changeFilter(($event.target as HTMLSelectElement).value)">
      <option v-for="f in filters" :key="f.id" :value="f.id">{{ t(`filters.${f.id}`) }}</option>
    </select>
    <select class="operator" :value="node.operator" :aria-label="t('rule.operator')" @change="changeOperator(($event.target as HTMLSelectElement).value as FilterOperator)">
      <option v-for="operator in filter.operators" :key="operator" :value="operator">{{ t(`operators.${operator}`) }}</option>
    </select>

    <div class="value">
      <div v-if="filter.input === 'radio'" class="chips" role="radiogroup">
        <label v-for="key in filter.values" :key="key" class="chip" :class="{ on: node.value === Number(key) }">
          <input class="sr-only" type="radio" :name="radioName" :checked="node.value === Number(key)" @change="update({ value: Number(key) })" />{{
            t(`values.${filter.id}.${key}`)
          }}
        </label>
      </div>
      <div v-else-if="filter.input === 'checkbox'" class="chips">
        <label v-for="key in filter.values" :key="key" class="chip" :class="{ on: selected.includes(key) }">
          <input class="sr-only" type="checkbox" :checked="selected.includes(key)" @change="toggle(key)" />{{ t(`values.${filter.id}.${key}`) }}
        </label>
      </div>
      <div v-else-if="node.operator === 'between'" class="range">
        <input
          type="number"
          :min="filter.min"
          step="1"
          :value="range[0]"
          :aria-label="t('rule.from')"
          @input="setRange(0, ($event.target as HTMLInputElement).value)"
          @change="settleRange"
        />
        <span>{{ t('rule.and') }}</span>
        <input
          type="number"
          :min="filter.min"
          step="1"
          :value="range[1]"
          :aria-label="t('rule.to')"
          @input="setRange(1, ($event.target as HTMLInputElement).value)"
          @change="settleRange"
        />
      </div>
      <input
        v-else-if="filter.type === 'integer'"
        type="number"
        :min="filter.min"
        step="1"
        :value="node.value"
        @input="update({ value: Number(($event.target as HTMLInputElement).value) })"
        @change="update({ value: clampNumber(filter, Number(($event.target as HTMLInputElement).value)) })"
      />
      <input
        v-else
        type="text"
        :value="node.value"
        :placeholder="multiple ? t('rule.multiplePlaceholder') : ''"
        @input="update({ value: ($event.target as HTMLInputElement).value })"
      />
      <TeamCheck v-if="node.id === 'team-name' && typeof node.value === 'string'" :value="node.value" @replace="replaceTeam" />
    </div>

    <label class="silent" :title="t('rule.silentHint')">
      <input type="checkbox" :checked="node.silent" @change="update({ silent: ($event.target as HTMLInputElement).checked })" />
      {{ t('rule.silent') }}
    </label>
    <button type="button" class="icon danger" :aria-label="t('rule.delete')" :title="t('rule.delete')" @click="emit('remove')"><AppIcon name="trash" /></button>
    <p v-if="issue" class="warning issue" role="alert"><AppIcon name="warning" />{{ t(`issues.${issue}`) }}</p>
  </div>
</template>

<script setup lang="ts">
import { Optic } from 'effect';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { Rule } from '@/challenge/types';
import AppIcon from './AppIcon.vue';
import TeamCheck from './TeamCheck.vue';
import { clampNumber, defaultValue, filters, findFilter, newGroup, newRule, ruleIssue, type FilterOperator } from './filters';

const { t } = useI18n();

// Rules are immutable: every edit emits the changed rule and the parent swaps it in, up to the root.
const props = withDefaults(defineProps<{ node: Rule; root?: boolean; depth?: number }>(), { depth: 0 });
const emit = defineEmits<{ change: [node: Rule]; remove: [] }>();

const issue = computed(() => ruleIssue(props.node));
const isGroup = computed(() => props.node.condition !== undefined);
const filter = computed(() => findFilter(props.node.id));
const multiple = computed(() => props.node.operator === 'in' || props.node.operator === 'not_in');
const radioName = `rule-${Math.random().toString(36).slice(2)}`;
const range = computed(() => (Array.isArray(props.node.value) ? (props.node.value as unknown[]) : [0, 0]));
const selected = computed(() => (Array.isArray(props.node.value) ? (props.node.value as string[]) : []));

const childAt = (index: number) => Optic.id<Rule>().key('rules').at(index);
const replaceChild = (index: number, next: Rule): Rule => Optic.replace(childAt(index), next)(props.node);

const update = (patch: Partial<Rule>) => emit('change', { ...props.node, ...patch });

function changeFilter(id: string) {
  emit('change', { ...newRule(id), silent: props.node.silent });
}

function changeOperator(operator: FilterOperator) {
  update({ operator, value: defaultValue(filter.value, operator) });
}

// Typing may pass through values that are not allowed (like a minus sign), so a value is only settled once the field is left.
function settleRange() {
  update({ value: range.value.map(n => clampNumber(filter.value, Number(n))) });
}

function replaceTeam(from: string, to: string) {
  const parts = String(props.node.value)
    .split(';')
    .map(part => (part.trim() === from ? to : part.trim()))
    .filter(part => part !== '');
  update({ value: [...new Set(parts)].join(';') });
}

function toggle(key: string) {
  update({ value: selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key] });
}

function setRange(index: 0 | 1, raw: string) {
  const next = [...range.value] as number[];
  next[index] = Number(raw);
  update({ value: next });
}
</script>

<style>
.group {
  border: 1px solid var(--border);
  border-left: 4px solid var(--group-color, var(--depth-0));
  border-radius: 8px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--group-color, var(--depth-0)) 6%, var(--surface));
}

.group-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.spacer {
  flex: 1;
}

select.pill {
  font-weight: 700;
  border-radius: 999px;
  padding: 4px 10px;
  min-height: 30px;
  color: var(--group-color);
  border-color: var(--group-color);
  background: color-mix(in srgb, var(--group-color) 12%, var(--surface));
}

.group-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.group-body:empty {
  display: none;
}

.rule {
  display: grid;
  grid-template-columns: minmax(180px, 260px) minmax(110px, 160px) minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.rule.invalid {
  background: color-mix(in srgb, var(--warn) 8%, var(--surface));
  border-color: color-mix(in srgb, var(--warn) 45%, var(--border));
}

.rule > button.icon {
  justify-self: end;
}

.rule .issue {
  grid-column: 1 / -1;
}

.value input[type='text'],
.value input[type='number'] {
  width: 100%;
}

.range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.range input {
  flex: 1;
  min-width: 0;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip {
  position: relative;
  padding: 4px 12px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  cursor: pointer;
  user-select: none;
  transition:
    background 0.12s,
    border-color 0.12s;
}

.chip:hover {
  border-color: var(--accent);
}

.chip.on {
  background: var(--accent-soft);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.chip:focus-within {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.silent {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
}

@media (max-width: 760px) {
  .rule {
    grid-template-columns: 1fr 1fr;
  }

  .rule .value {
    grid-column: 1 / -1;
  }
}
</style>
