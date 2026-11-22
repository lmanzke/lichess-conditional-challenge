<template>
  <div v-if="groupNode" class="group" :style="{ '--group-color': `var(--depth-${depth % 4})` }">
    <div class="group-header">
      <select
        class="pill"
        :value="groupNode.combinator"
        :aria-label="t('rule.combinator')"
        @change="editGroup(group => setCombinator(group, ($event.target as HTMLSelectElement).value as Combinator))"
      >
        <option value="AND">{{ t('rule.combinators.AND') }}</option>
        <option value="OR">{{ t('rule.combinators.OR') }}</option>
      </select>
      <button type="button" class="ghost" @click="editGroup(group => addChild(group, newRule()))"><AppIcon name="plus" />{{ t('rule.addRule') }}</button>
      <button type="button" class="ghost" @click="editGroup(group => addChild(group, newGroup()))"><AppIcon name="group" />{{ t('rule.addGroup') }}</button>
      <span class="spacer"></span>
      <button v-if="!root" type="button" class="icon danger" :aria-label="t('rule.deleteGroup')" :title="t('rule.deleteGroup')" @click="emit('remove')">
        <AppIcon name="trash" />
      </button>
    </div>
    <p v-if="issue" class="warning" role="alert"><AppIcon name="warning" />{{ t(`issues.${issue}`, ratingRange) }}</p>
    <div class="group-body">
      <RuleNode
        v-for="(child, index) in groupNode.children"
        :key="index"
        :node="child"
        :depth="depth + 1"
        @change="next => editGroup(group => replaceChild(group, index, next))"
        @remove="editGroup(group => removeChild(group, index))"
      />
    </div>
  </div>

  <div v-else-if="ruleNode" class="rule" :class="{ invalid: issue }">
    <select class="rule-field" :value="ruleNode.field" :aria-label="t('rule.field')" @change="changeField(($event.target as HTMLSelectElement).value)">
      <option v-for="f in fields" :key="f.id" :value="f.id">{{ t(`fields.${f.id}`) }}</option>
    </select>
    <select class="relation" :value="ruleNode.relation" :aria-label="t('rule.relation')" @change="changeRelation(($event.target as HTMLSelectElement).value as RelationCode)">
      <option v-for="relation in field.relations" :key="relation" :value="relation">{{ t(`relations.${relation}`) }}</option>
    </select>

    <div class="value">
      <div v-if="field.input === 'radio'" class="chips" role="radiogroup">
        <label v-for="key in field.values" :key="key" class="chip" :class="{ on: ruleNode.value === Number(key) }">
          <input class="sr-only" type="radio" :name="radioName" :checked="ruleNode.value === Number(key)" @change="setRuleValue(Number(key))" />{{ t(`values.${field.id}.${key}`) }}
        </label>
      </div>
      <div v-else-if="field.input === 'checkbox'" class="chips">
        <label v-for="key in field.values" :key="key" class="chip" :class="{ on: selected.includes(key) }">
          <input class="sr-only" type="checkbox" :checked="selected.includes(key)" @change="toggle(key)" />{{ t(`values.${field.id}.${key}`) }}
        </label>
      </div>
      <div v-else-if="ruleNode.relation === 'between'" class="range">
        <input
          type="number"
          :min="field.min"
          step="1"
          :value="range[0]"
          :aria-label="t('rule.from')"
          @input="setRange(0, ($event.target as HTMLInputElement).value)"
          @change="settleRange"
        />
        <span>{{ t('rule.and') }}</span>
        <input
          type="number"
          :min="field.min"
          step="1"
          :value="range[1]"
          :aria-label="t('rule.to')"
          @input="setRange(1, ($event.target as HTMLInputElement).value)"
          @change="settleRange"
        />
      </div>
      <input
        v-else-if="field.type === 'integer'"
        type="number"
        :min="field.min"
        step="1"
        :value="ruleNode.value"
        @input="setRuleValue(Number(($event.target as HTMLInputElement).value))"
        @change="setRuleValue(clampNumber(field, Number(($event.target as HTMLInputElement).value)))"
      />
      <input
        v-else
        type="text"
        :value="ruleNode.value"
        :placeholder="multiple ? t('rule.multiplePlaceholder') : ''"
        @input="setRuleValue(($event.target as HTMLInputElement).value)"
      />
      <TeamCheck v-if="ruleNode.field === 'team-name' && typeof ruleNode.value === 'string'" :value="ruleNode.value" @replace="replaceTeam" />
    </div>

    <label class="silent" :title="t('rule.silentHint')">
      <input type="checkbox" :checked="ruleNode.silent" @change="edit(rule => setSilent(rule, ($event.target as HTMLInputElement).checked))" />
      {{ t('rule.silent') }}
    </label>
    <button type="button" class="icon danger" :aria-label="t('rule.delete')" :title="t('rule.delete')" @click="emit('remove')"><AppIcon name="trash" /></button>
    <p v-if="issue" class="warning issue" role="alert"><AppIcon name="warning" />{{ t(`issues.${issue}`, ratingRange) }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { RATING_RANGE, clampNumber, fields, findField } from '@/challenge/fields';
import type { RelationCode } from '@/challenge/relations';
import {
  addChild,
  newGroup,
  newRule,
  removeChild,
  replaceChild,
  ruleIssue,
  setCombinator,
  setField,
  setRelation,
  setSilent,
  setValue,
  settleRange as settleRangeOf,
} from '@/challenge/rule-tree';
import { isRuleGroup, type Combinator, type Rule, type RuleGroup, type RuleNode as RuleNodeData, type RuleValue } from '@/challenge/types';
import AppIcon from './AppIcon.vue';
import TeamCheck from './TeamCheck.vue';

const { t } = useI18n();

// The edits are operations of the rule tree module: every edit emits the changed node and the parent swaps it in, up to the root.
const props = withDefaults(defineProps<{ node: RuleNodeData; root?: boolean; depth?: number }>(), { depth: 0 });
const emit = defineEmits<{ change: [node: RuleNodeData]; remove: [] }>();

const ratingRange = RATING_RANGE;
const issue = computed(() => ruleIssue(props.node));
const groupNode = computed(() => (isRuleGroup(props.node) ? props.node : undefined));
const ruleNode = computed(() => (isRuleGroup(props.node) ? undefined : props.node));
const field = computed(() => findField(ruleNode.value?.field ?? ''));
const multiple = computed(() => ruleNode.value?.relation === 'in' || ruleNode.value?.relation === 'not_in');
const radioName = `rule-${Math.random().toString(36).slice(2)}`;
const range = computed(() => (Array.isArray(ruleNode.value?.value) ? (ruleNode.value.value as unknown[]) : [0, 0]));
const selected = computed(() => (Array.isArray(ruleNode.value?.value) ? (ruleNode.value.value as string[]) : []));

const editGroup = (edit: (group: RuleGroup) => RuleNodeData) => groupNode.value && emit('change', edit(groupNode.value));
const edit = (change: (rule: Rule) => Rule) => ruleNode.value && emit('change', change(ruleNode.value));
const setRuleValue = (value: RuleValue) => edit(rule => setValue(rule, value));

const changeField = (id: string) => edit(rule => setField(rule, id));
const changeRelation = (relation: RelationCode) => edit(rule => setRelation(rule, relation));

// Typing may pass through values that are not allowed (like a minus sign), so a value is only settled once the field is left.
const settleRange = () => edit(rule => settleRangeOf(rule, range.value));

function replaceTeam(from: string, to: string) {
  const parts = String(ruleNode.value?.value)
    .split(';')
    .map(part => (part.trim() === from ? to : part.trim()))
    .filter(part => part !== '');
  setRuleValue([...new Set(parts)].join(';'));
}

const toggle = (key: string) => setRuleValue(selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key]);

function setRange(index: 0 | 1, raw: string) {
  const next = [...range.value] as number[];
  next[index] = Number(raw);
  setRuleValue(next);
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
