import type { RelationCode } from '@/challenge/relations';
import { isRuleGroup, type Rule, type RuleGroup, type RuleNode, type RuleValue } from '@/challenge/types';
import type { Translate } from '@/i18n';

export interface FieldDefinition {
  id: string;
  type: 'string' | 'integer';
  /** Renders a set of choices instead of a free input. 'radio' picks one, 'checkbox' any number of them. */
  input?: 'radio' | 'checkbox';
  /** The keys of the choices. Their labels are the messages `values.<field id>.<key>`. */
  values?: string[];
  relations: RelationCode[];
  /** The smallest value that makes sense for a number. */
  min?: number;
  /** The values that actually occur. A rule outside of them is allowed, but pointless. */
  plausible?: { min: number; max: number };
  /** The value a new rule starts with (and the center of a new range), instead of 0. */
  start?: number;
}

/** Lichess ratings are not found outside of this range in practice. */
export const RATING_RANGE = { min: 100, max: 3000 };

const stringRelations: RelationCode[] = ['equal', 'not_equal', 'not_in', 'in'];
const numberRelations: RelationCode[] = ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'];
const numberRelationsWithEqual: RelationCode[] = [...numberRelations, 'equal'];
const inRelations: RelationCode[] = ['in', 'not_in'];

export const fields: FieldDefinition[] = [
  { id: 'team-name', type: 'string', relations: stringRelations },
  { id: 'user-id', type: 'string', relations: stringRelations },
  { id: 'encounters', type: 'integer', min: 0, relations: numberRelations },
  { id: 'encountersToday', type: 'integer', min: 0, relations: numberRelations },
  { id: 'rating', type: 'integer', min: 0, plausible: RATING_RANGE, start: 1500, relations: numberRelationsWithEqual },
  { id: 'rated', type: 'integer', input: 'radio', values: ['1', '0'], relations: ['equal'] },
  { id: 'provisional', type: 'integer', input: 'radio', values: ['1', '0'], relations: ['equal'] },
  {
    id: 'variant',
    type: 'string',
    input: 'checkbox',
    values: ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'],
    relations: inRelations,
  },
  {
    id: 'timecontrolType',
    type: 'string',
    input: 'checkbox',
    values: ['clock', 'correspondence', 'unlimited'],
    relations: inRelations,
  },
  { id: 'limitSeconds', type: 'integer', min: 0, relations: numberRelationsWithEqual },
  { id: 'incrementSeconds', type: 'integer', min: 0, relations: numberRelationsWithEqual },
  {
    id: 'challengeColor',
    type: 'string',
    input: 'checkbox',
    values: ['black', 'white', 'random'],
    relations: inRelations,
  },
];

export const findField = (id: string): FieldDefinition => fields.find(field => field.id === id) ?? fields[0];

export const defaultValue = (field: FieldDefinition, relation: RelationCode): RuleValue => {
  if (field.input === 'checkbox') return [];
  if (field.input === 'radio') return 1;
  const start = field.start ?? 0;
  if (relation === 'between') return field.start === undefined ? [0, 0] : [start - 300, start + 300];
  return field.type === 'integer' ? start : '';
};

export const newRule = (fieldId = 'rating'): Rule => {
  const field = findField(fieldId);
  const relation = field.relations[0];
  return { field: field.id, relation, value: defaultValue(field, relation), silent: false };
};

export const newGroup = (): RuleGroup => ({ combinator: 'AND', children: [newRule()] });

const describeValue = (field: FieldDefinition, value: RuleValue, t: Translate): string => {
  const label = (v: unknown) => (field.values ? t(`values.${field.id}.${String(v)}`) : String(v));
  return Array.isArray(value) ? value.map(label).join(field.input ? ', ' : ` ${t('rule.and')} `) : label(value);
};

/** A plain text outline of a rule tree, as bullet lines. A challenge is accepted if the outline holds. */
export const describeRule = (node: RuleNode, t: Translate, depth = 0): string => {
  const indent = '  '.repeat(depth);
  if (!isRuleGroup(node)) {
    const field = findField(node.field);
    const silent = node.silent ? ` (${t('describe.silent')})` : '';
    return `${indent}• ${t(`fields.${field.id}`)} ${t(`relations.${node.relation}`)} ${describeValue(field, node.value, t)}${silent}`;
  }
  const head = `${indent}${depth === 0 ? '' : '• '}${t(node.combinator === 'OR' ? 'describe.anyOf' : 'describe.allOf')}:`;
  return [head, ...node.children.map(child => describeRule(child, t, depth + 1))].join('\n');
};

export type RuleIssue = 'emptyGroup' | 'noChoice' | 'emptyValue' | 'rangeReversed' | 'belowMinimum' | 'notInteger' | 'implausible';

/** What is wrong with this rule itself (not with its children). Such a rule is saved anyway, but can never match or never fail as intended. */
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

/** Rounds to a whole number and keeps it within the allowed range of the field. */
export const clampNumber = (field: FieldDefinition, value: number): number => {
  const whole = Number.isFinite(value) ? Math.round(value) : 0;
  return field.min === undefined ? whole : Math.max(field.min, whole);
};
