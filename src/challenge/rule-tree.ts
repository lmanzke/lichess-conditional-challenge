import { clampNumber, defaultValue, findField } from '@/challenge/fields';
import type { Translate } from '@/i18n';
import type { RelationCode } from '@/challenge/relations';
import { isRuleGroup, type Combinator, type Rule, type RuleGroup, type RuleNode, type RuleValue } from '@/challenge/types';

export const newRule = (fieldId = 'rating'): Rule => {
  const field = findField(fieldId);
  const relation = field.relations[0];
  return { field: field.id, relation, value: defaultValue(field, relation), silent: false };
};

export const newGroup = (): RuleGroup => ({ combinator: 'AND', children: [newRule()] });

// Editing. Nodes are immutable, so every operation returns the changed node.

/** Another field starts over with the value of its own, only the silent flag is kept. */
export const setField = (rule: Rule, fieldId: string): Rule => ({ ...newRule(fieldId), silent: rule.silent });

export const setRelation = (rule: Rule, relation: RelationCode): Rule => ({ ...rule, relation, value: defaultValue(findField(rule.field), relation) });

export const setValue = (rule: Rule, value: RuleValue): Rule => ({ ...rule, value });

/** Rounds the numbers of a range, which is only done once the input is left, as typing passes through values that are not allowed. */
export const settleRange = (rule: Rule, range: unknown[]): Rule =>
  setValue(
    rule,
    range.map(n => clampNumber(findField(rule.field), Number(n)))
  );

export const setSilent = (rule: Rule, silent: boolean): Rule => ({ ...rule, silent });

export const setCombinator = (group: RuleGroup, combinator: Combinator): RuleGroup => ({ ...group, combinator });

export const addChild = (group: RuleGroup, child: RuleNode): RuleGroup => ({ ...group, children: [...group.children, child] });

export const removeChild = (group: RuleGroup, index: number): RuleGroup => ({ ...group, children: group.children.filter((_, i) => i !== index) });

export const replaceChild = (group: RuleGroup, index: number, next: RuleNode): RuleGroup => ({
  ...group,
  children: group.children.map((child, i) => (i === index ? next : child)),
});

const describeValue = (fieldId: string, value: RuleValue, t: Translate): string => {
  const field = findField(fieldId);
  const label = (v: unknown) => (field.values ? t(`values.${field.id}.${String(v)}`) : String(v));
  return Array.isArray(value) ? value.map(label).join(field.input ? ', ' : ` ${t('rule.and')} `) : label(value);
};

/** A plain text outline of a rule tree, as bullet lines. A challenge is accepted if the outline holds. */
export const describeRule = (node: RuleNode, t: Translate, depth = 0): string => {
  const indent = '  '.repeat(depth);
  if (!isRuleGroup(node)) {
    const field = findField(node.field);
    const silent = node.silent ? ` (${t('describe.silent')})` : '';
    return `${indent}• ${t(`fields.${field.id}`)} ${t(`relations.${node.relation}`)} ${describeValue(node.field, node.value, t)}${silent}`;
  }
  const head = `${indent}${depth === 0 ? '' : '• '}${t(node.combinator === 'OR' ? 'describe.anyOf' : 'describe.allOf')}:`;
  return [head, ...node.children.map(child => describeRule(child, t, depth + 1))].join('\n');
};

export type RuleIssue = 'emptyGroup' | 'noChoice' | 'emptyValue' | 'rangeReversed' | 'belowMinimum' | 'notInteger' | 'implausible';

/** What is wrong with this node itself (not with its children). Such a rule is saved anyway, but can never match or never fail as intended. */
export const ruleIssue = (rule: RuleNode): RuleIssue | undefined => {
  if (isRuleGroup(rule)) {
    return rule.children.length === 0 ? 'emptyGroup' : undefined;
  }

  const field = findField(rule.field);
  const value = rule.value;
  if (field.input === 'checkbox') {
    return Array.isArray(value) && value.length > 0 ? undefined : 'noChoice';
  }
  if (field.type === 'integer' && !field.input) {
    const numbers = (Array.isArray(value) ? value : [value]).map(Number);
    if (numbers.some(n => !Number.isInteger(n))) return 'notInteger';
    if (field.min !== undefined && numbers.some(n => n < (field.min as number))) return 'belowMinimum';
    if (field.plausible && numbers.some(n => n < (field.plausible as { min: number }).min || n > (field.plausible as { max: number }).max)) return 'implausible';
  }
  if (rule.relation === 'between' && Array.isArray(value)) {
    return Number(value[0]) > Number(value[1]) ? 'rangeReversed' : undefined;
  }
  if (field.type === 'string' && typeof value === 'string') {
    return value.split(';').some(part => part.trim() !== '') ? undefined : 'emptyValue';
  }
  return undefined;
};

export const countIssues = (node: RuleNode): number => (ruleIssue(node) ? 1 : 0) + (isRuleGroup(node) ? node.children.reduce((sum, child) => sum + countIssues(child), 0) : 0);
