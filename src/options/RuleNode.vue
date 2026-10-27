<template>
  <div v-if="isGroup" class="group">
    <div class="group-header">
      <select :value="node.condition" @change="update({ condition: ($event.target as HTMLSelectElement).value })">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <button type="button" @click="update({ rules: [...node.rules, newRule()] })">Add rule</button>
      <button type="button" @click="update({ rules: [...node.rules, newGroup()] })">Add group</button>
      <button v-if="!root" type="button" class="danger" @click="emit('remove')">Delete group</button>
    </div>
    <div class="group-body">
      <RuleNode
        v-for="(child, index) in node.rules"
        :key="index"
        :node="child"
        @change="next => emit('change', replaceChild(index, next))"
        @remove="update({ rules: node.rules.filter((_, i) => i !== index) })"
      />
    </div>
  </div>

  <div v-else class="rule">
    <select :value="node.id" @change="changeFilter(($event.target as HTMLSelectElement).value)">
      <option v-for="f in filters" :key="f.id" :value="f.id">{{ f.label }}</option>
    </select>
    <select :value="node.operator" @change="changeOperator(($event.target as HTMLSelectElement).value as FilterOperator)">
      <option v-for="operator in filter.operators" :key="operator" :value="operator">{{ operatorLabels[operator] }}</option>
    </select>

    <span v-if="filter.input === 'radio'" class="choices">
      <label v-for="(label, key) in filter.values" :key="key"
        ><input type="radio" :name="radioName" :checked="node.value === Number(key)" @change="update({ value: Number(key) })" /> {{ label }}</label
      >
    </span>
    <span v-else-if="filter.input === 'checkbox'" class="choices">
      <label v-for="(label, key) in filter.values" :key="key"><input type="checkbox" :checked="selected.includes(String(key))" @change="toggle(String(key))" /> {{ label }}</label>
    </span>
    <span v-else-if="node.operator === 'between'" class="choices">
      <input type="number" :value="range[0]" @input="setRange(0, ($event.target as HTMLInputElement).value)" />
      and
      <input type="number" :value="range[1]" @input="setRange(1, ($event.target as HTMLInputElement).value)" />
    </span>
    <input v-else-if="filter.type === 'integer'" type="number" :value="node.value" @input="update({ value: Number(($event.target as HTMLInputElement).value) })" />
    <input v-else type="text" :value="node.value" :placeholder="multiple ? 'values separated by ;' : ''" @input="update({ value: ($event.target as HTMLInputElement).value })" />

    <label class="silent"><input type="checkbox" :checked="node.silent" @change="update({ silent: ($event.target as HTMLInputElement).checked })" /> Silent</label>
    <button type="button" class="danger" @click="emit('remove')">Delete</button>
  </div>
</template>

<script setup lang="ts">
import { Optic } from 'effect';
import { computed } from 'vue';
import type { Rule } from '@/challenge/types';
import { defaultValue, filters, findFilter, newGroup, newRule, operatorLabels, type FilterOperator } from './filters';

// Rules are immutable: every edit emits the changed rule and the parent swaps it in, up to the root.
const props = defineProps<{ node: Rule; root?: boolean }>();
const emit = defineEmits<{ change: [node: Rule]; remove: [] }>();

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

function toggle(key: string) {
  update({ value: selected.value.includes(key) ? selected.value.filter(k => k !== key) : [...selected.value, key] });
}

function setRange(index: 0 | 1, raw: string) {
  const next = [...range.value] as number[];
  next[index] = Number(raw);
  update({ value: next });
}
</script>
