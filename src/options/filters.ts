import type { Rule, RuleValue } from '@/challenge/types';
import type { Translate } from '@/i18n';

export type FilterOperator = 'equal' | 'not_equal' | 'in' | 'not_in' | 'less' | 'less_or_equal' | 'greater' | 'greater_or_equal' | 'between';

export interface Filter {
  id: string;
  type: 'string' | 'integer';
  /** Renders a set of choices instead of a free input. 'radio' picks one, 'checkbox' any number of them. */
  input?: 'radio' | 'checkbox';
  /** The keys of the choices. Their labels are the messages `values.<filter id>.<key>`. */
  values?: string[];
  operators: FilterOperator[];
  /** The smallest value that makes sense for a number. */
  min?: number;
  /** The values that actually occur. A rule outside of them is allowed, but pointless. */
  plausible?: { min: number; max: number };
  /** The value a new rule starts with (and the center of a new range), instead of 0. */
  start?: number;
}

/** Lichess ratings are not found outside of this range in practice. */
export const RATING_RANGE = { min: 100, max: 3000 };

const stringOperators: FilterOperator[] = ['equal', 'not_equal', 'not_in', 'in'];
const numberOperators: FilterOperator[] = ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'];
const numberOperatorsWithEqual: FilterOperator[] = [...numberOperators, 'equal'];
const inOperators: FilterOperator[] = ['in', 'not_in'];

export const filters: Filter[] = [
  { id: 'team-name', type: 'string', operators: stringOperators },
  { id: 'user-id', type: 'string', operators: stringOperators },
  { id: 'encounters', type: 'integer', min: 0, operators: numberOperators },
  { id: 'encountersToday', type: 'integer', min: 0, operators: numberOperators },
  { id: 'rating', type: 'integer', min: 0, plausible: RATING_RANGE, start: 1500, operators: numberOperatorsWithEqual },
  { id: 'rated', type: 'integer', input: 'radio', values: ['1', '0'], operators: ['equal'] },
  {
    id: 'variant',
    type: 'string',
    input: 'checkbox',
    values: ['standard', 'chess960', 'crazyhouse', 'antichess', 'atomic', 'horde', 'kingOfTheHill', 'racingKings', 'threeCheck'],
    operators: inOperators,
  },
  {
    id: 'timecontrolType',
    type: 'string',
    input: 'checkbox',
    values: ['clock', 'correspondence', 'unlimited'],
    operators: inOperators,
  },
  { id: 'limitSeconds', type: 'integer', min: 0, operators: numberOperatorsWithEqual },
  { id: 'incrementSeconds', type: 'integer', min: 0, operators: numberOperatorsWithEqual },
  {
    id: 'challengeColor',
    type: 'string',
    input: 'checkbox',
    values: ['black', 'white', 'random'],
    operators: inOperators,
  },
];

export const findFilter = (id: string): Filter => filters.find(filter => filter.id === id) ?? filters[0];

export const defaultValue = (filter: Filter, operator: FilterOperator): RuleValue => {
  if (filter.input === 'checkbox') return [];
  if (filter.input === 'radio') return 1;
  const start = filter.start ?? 0;
  if (operator === 'between') return filter.start === undefined ? [0, 0] : [start - 300, start + 300];
  return filter.type === 'integer' ? start : '';
};

export const newRule = (filterId = 'rating'): Rule => {
  const filter = findFilter(filterId);
  const operator = filter.operators[0];
  return { id: filter.id, operator, value: defaultValue(filter, operator), silent: false, rules: [], condition: undefined };
};

export const newGroup = (): Rule => ({ condition: 'AND', rules: [newRule()], id: '', operator: '', value: '', silent: false });

const describeValue = (filter: Filter, value: RuleValue, t: Translate): string => {
  const label = (v: unknown) => (filter.values ? t(`values.${filter.id}.${String(v)}`) : String(v));
  return Array.isArray(value) ? value.map(label).join(filter.input ? ', ' : ` ${t('rule.and')} `) : label(value);
};

/** A plain text outline of a rule tree, as bullet lines. A challenge is accepted if the outline holds. */
export const describeRule = (rule: Rule, t: Translate, depth = 0): string => {
  const indent = '  '.repeat(depth);
  if (rule.condition === undefined) {
    const filter = findFilter(rule.id);
    const silent = rule.silent ? ` (${t('describe.silent')})` : '';
    return `${indent}• ${t(`filters.${filter.id}`)} ${t(`operators.${rule.operator}`)} ${describeValue(filter, rule.value, t)}${silent}`;
  }
  const head = `${indent}${depth === 0 ? '' : '• '}${t(rule.condition === 'OR' ? 'describe.anyOf' : 'describe.allOf')}:`;
  return [head, ...rule.rules.map(child => describeRule(child, t, depth + 1))].join('\n');
};

export type RuleIssue = 'emptyGroup' | 'noChoice' | 'emptyValue' | 'rangeReversed' | 'belowMinimum' | 'notInteger' | 'implausible';

/** What is wrong with this rule itself (not with its children). Such a rule is saved anyway, but can never match or never fail as intended. */
export const ruleIssue = (rule: Rule): RuleIssue | undefined => {
  if (rule.condition !== undefined) {
    return rule.rules.length === 0 ? 'emptyGroup' : undefined;
  }

  const filter = findFilter(rule.id);
  const value = rule.value;
  if (filter.input === 'checkbox') {
    return Array.isArray(value) && value.length > 0 ? undefined : 'noChoice';
  }
  if (filter.type === 'integer' && !filter.input) {
    const numbers = (Array.isArray(value) ? value : [value]).map(Number);
    if (numbers.some(n => !Number.isInteger(n))) return 'notInteger';
    if (filter.min !== undefined && numbers.some(n => n < (filter.min as number))) return 'belowMinimum';
    if (filter.plausible && numbers.some(n => n < (filter.plausible as { min: number }).min || n > (filter.plausible as { max: number }).max)) return 'implausible';
  }
  if (rule.operator === 'between' && Array.isArray(value)) {
    return Number(value[0]) > Number(value[1]) ? 'rangeReversed' : undefined;
  }
  if (filter.type === 'string' && typeof value === 'string') {
    return value.split(';').some(part => part.trim() !== '') ? undefined : 'emptyValue';
  }
  return undefined;
};

export const countIssues = (rule: Rule): number => (ruleIssue(rule) ? 1 : 0) + rule.rules.reduce((sum, child) => sum + countIssues(child), 0);

/** Rounds to a whole number and keeps it within the allowed range of the filter. */
export const clampNumber = (filter: Filter, value: number): number => {
  const whole = Number.isFinite(value) ? Math.round(value) : 0;
  return filter.min === undefined ? whole : Math.max(filter.min, whole);
};
