<template>
  <div v-if="isGroup" class="group">
    <div class="group-header">
      <select v-model="node.condition">
        <option value="AND">AND</option>
        <option value="OR">OR</option>
      </select>
      <button type="button" @click="node.rules.push(newRule())">Add rule</button>
      <button type="button" @click="node.rules.push(newGroup())">Add group</button>
      <button v-if="!root" type="button" class="danger" @click="emit('remove')">Delete group</button>
    </div>
    <div class="group-body">
      <RuleNode v-for="(child, index) in node.rules" :key="index" :node="child" @remove="node.rules.splice(index, 1)" />
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
        ><input type="radio" :name="radioName" :checked="node.value === Number(key)" @change="node.value = Number(key)" /> {{ label }}</label
      >
    </span>
    <span v-else-if="filter.input === 'checkbox'" class="choices">
      <label v-for="(label, key) in filter.values" :key="key"><input v-model="node.value" type="checkbox" :value="key" /> {{ label }}</label>
    </span>
    <span v-else-if="node.operator === 'between'" class="choices">
      <input type="number" :value="range[0]" @input="setRange(0, ($event.target as HTMLInputElement).value)" />
      and
      <input type="number" :value="range[1]" @input="setRange(1, ($event.target as HTMLInputElement).value)" />
    </span>
    <input v-else-if="filter.type === 'integer'" type="number" :value="node.value" @input="node.value = Number(($event.target as HTMLInputElement).value)" />
    <input v-else v-model="node.value" type="text" :placeholder="multiple ? 'values separated by ;' : ''" />

    <label class="silent"><input v-model="node.silent" type="checkbox" /> Silent</label>
    <button type="button" class="danger" @click="emit('remove')">Delete</button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Rule } from '@/challenge/types';
import { defaultValue, filters, findFilter, newGroup, newRule, operatorLabels, type FilterOperator } from './filters';

const props = defineProps<{ node: Rule; root?: boolean }>();
const emit = defineEmits<{ remove: [] }>();

const isGroup = computed(() => props.node.condition !== undefined);
const filter = computed(() => findFilter(props.node.id));
const multiple = computed(() => props.node.operator === 'in' || props.node.operator === 'not_in');
const radioName = `rule-${Math.random().toString(36).slice(2)}`;
const range = computed(() => (Array.isArray(props.node.value) ? (props.node.value as unknown[]) : [0, 0]));

function changeFilter(id: string) {
  Object.assign(props.node, newRule(id), { silent: props.node.silent });
}

function changeOperator(operator: FilterOperator) {
  props.node.operator = operator;
  props.node.value = defaultValue(filter.value, operator);
}

function setRange(index: 0 | 1, raw: string) {
  const next = [...range.value] as number[];
  next[index] = Number(raw);
  props.node.value = next;
}
</script>
