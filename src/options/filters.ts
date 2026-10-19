import type { Rule, RuleValue } from '@/challenge/types';

export type FilterOperator = 'equal' | 'not_equal' | 'in' | 'not_in' | 'less' | 'less_or_equal' | 'greater' | 'greater_or_equal' | 'between';

export interface Filter {
  id: string;
  label: string;
  type: 'string' | 'integer';
  /** Renders a set of choices instead of a free input. 'radio' picks one, 'checkbox' any number of them. */
  input?: 'radio' | 'checkbox';
  values?: Record<string, string>;
  operators: FilterOperator[];
}

export const operatorLabels: Record<FilterOperator, string> = {
  equal: 'equal',
  not_equal: 'not equal',
  in: 'in',
  not_in: 'not in',
  less: 'less',
  less_or_equal: 'less or equal',
  greater: 'greater',
  greater_or_equal: 'greater or equal',
  between: 'between',
};

const stringOperators: FilterOperator[] = ['equal', 'not_equal', 'not_in', 'in'];
const numberOperators: FilterOperator[] = ['less', 'less_or_equal', 'greater', 'greater_or_equal', 'between'];
const numberOperatorsWithEqual: FilterOperator[] = [...numberOperators, 'equal'];
const inOperators: FilterOperator[] = ['in', 'not_in'];

export const filters: Filter[] = [
  { id: 'team-name', label: 'Team Name', type: 'string', operators: stringOperators },
  { id: 'user-id', label: 'User Id', type: 'string', operators: stringOperators },
  { id: 'encounters', label: 'Number of past encounters', type: 'integer', operators: numberOperators },
  { id: 'encountersToday', label: 'Number of encounters today', type: 'integer', operators: numberOperators },
  { id: 'rating', label: 'Rating', type: 'integer', operators: numberOperatorsWithEqual },
  { id: 'rated', label: 'Rated', type: 'integer', input: 'radio', values: { 1: 'Yes', 0: 'No' }, operators: ['equal'] },
  {
    id: 'variant',
    label: 'Variant',
    type: 'string',
    input: 'checkbox',
    values: {
      standard: 'Standard',
      chess960: 'Chess960',
      crazyhouse: 'Crazyhouse',
      antichess: 'Antichess',
      atomic: 'Atomic',
      horde: 'Horde',
      kingOfTheHill: 'King Of The Hill',
      racingKings: 'Racing Kings',
      threeCheck: 'Three Check',
    },
    operators: inOperators,
  },
  {
    id: 'timecontrolType',
    label: 'Timecontrol Type',
    type: 'string',
    input: 'checkbox',
    values: { clock: 'Real Time', correspondence: 'Correspondence', unlimited: 'Unlimited' },
    operators: inOperators,
  },
  { id: 'limitSeconds', label: 'Timelimit in seconds', type: 'integer', operators: numberOperatorsWithEqual },
  { id: 'incrementSeconds', label: 'Increment in seconds', type: 'integer', operators: numberOperatorsWithEqual },
  {
    id: 'challengeColor',
    label: 'Your Assigned Color',
    type: 'string',
    input: 'checkbox',
    // The color is the challenger's, which is the opposite of the one you get.
    values: { black: 'White', white: 'Black', random: 'Random' },
    operators: inOperators,
  },
];

export const findFilter = (id: string): Filter => filters.find(filter => filter.id === id) ?? filters[0];

export const defaultValue = (filter: Filter, operator: FilterOperator): RuleValue => {
  if (filter.input === 'checkbox') return [];
  if (filter.input === 'radio') return 1;
  if (operator === 'between') return [0, 0];
  return filter.type === 'integer' ? 0 : '';
};

export const newRule = (filterId = 'rating'): Rule => {
  const filter = findFilter(filterId);
  const operator = filter.operators[0];
  return { id: filter.id, operator, value: defaultValue(filter, operator), silent: false, rules: [], condition: undefined };
};

export const newGroup = (): Rule => ({ condition: 'AND', rules: [newRule()], id: '', operator: '', value: '', silent: false });

export const defaultRules = (): Rule => ({ condition: 'AND', rules: [{ ...newRule(), operator: 'greater' }], id: '', operator: '', value: '', silent: false });
