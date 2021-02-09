import { ordNumber } from 'fp-ts/Ord';
import * as O from 'fp-ts/Option';
import { Ordering } from 'fp-ts/Ordering';
import { flow, not, Predicate } from 'fp-ts/function';
import { RuleValueType } from '@/challenge/types';

export enum Relation {
  LESS_THAN = 'LT',
  LESS_THAN_EQUAL = 'LTE',
  GREATER_THAN = 'GT',
  GREATER_THAN_EQUAL = 'GTE',
  EQUAL = 'EQ',
  NOT_EQUAL = 'NEQ',
  NOT_IN = 'NIN',
  IN = 'IN',
  BETWEEN = 'BETW',
  NOT_BETWEEN = 'NBETW',
}

export const mapOperator = (operator: string): Relation => {
  switch (operator) {
    case 'less':
      return Relation.LESS_THAN;
    case 'less_or_equal':
      return Relation.LESS_THAN_EQUAL;
    case 'greater':
      return Relation.GREATER_THAN;
    case 'greater_or_equal':
      return Relation.GREATER_THAN_EQUAL;
    case 'not_equal':
      return Relation.NOT_EQUAL;
    case 'not_in':
      return Relation.NOT_IN;
    case 'in':
      return Relation.IN;
    case 'between':
      return Relation.BETWEEN;
    case 'equal':
    default:
      return Relation.EQUAL;
  }
};

export const ordOptionNumber = O.getOrd(ordNumber);
export const eqOptionNumber = O.getEq(ordNumber);

export const toNumber = (value: RuleValueType | undefined | null): O.Option<number> => {
  if (typeof value === 'undefined' || typeof value === 'boolean' || value === null) {
    return O.none;
  }

  if (typeof value === 'number') {
    return O.some(value);
  }

  if (Array.isArray(value)) {
    return O.none;
  }

  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    return O.none;
  }

  return O.some(parsed);
};

export const numberComparison = (predicate: Predicate<Ordering>) => (value: RuleValueType | number[] | string[]): Predicate<RuleValueType> => (candidate: RuleValueType) => {
  if (Array.isArray(value)) {
    return false;
  }

  if (typeof value === 'boolean' || typeof candidate === 'boolean') {
    return false;
  }

  const valueNumber = toNumber(value);
  const candidateNumber = toNumber(candidate);

  return predicate(ordOptionNumber.compare(candidateNumber, valueNumber));
};

const eq = <A>(value: A): Predicate<A> => (candidate: A) => value === candidate;
const notEq = flow(eq, not);
const _oneOf = <A>(value: A[]): Predicate<A> => (candidate: A) => value.includes(candidate);

export const lessThan = numberComparison(eq<Ordering>(-1));
export const greaterThan = numberComparison(eq<Ordering>(1));
export const lessThanEqual = flow(greaterThan, not);
export const greaterThanEqual = flow(lessThan, not);

const isStringArray = (value: unknown[]): value is string[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(v => typeof v === 'string');
};

const isNumberArray = (value: unknown[]): value is number[] => {
  if (!Array.isArray(value)) {
    return false;
  }

  return value.every(v => typeof v === 'number');
};

const isIn = (value: RuleValueType | number[] | string[]): Predicate<RuleValueType> => (candidate: RuleValueType) => {
  if (typeof value === 'number' || typeof value === 'boolean') {
    return false;
  }

  if (typeof candidate === 'boolean') {
    return false;
  }

  if (typeof value === 'string') {
    value = value.split(';');
  }

  if (isNumberArray(value)) {
    return value.some(v => eqOptionNumber.equals(O.of(v), toNumber(candidate)));
  }

  return value.includes(candidate.toString());
};

const optionMin = (numberOptions: O.Option<number>[]) =>
  numberOptions.reduce((min, option) => {
    const currentValue = O.getOrElse(() => Number.MAX_VALUE)(option);
    return ordNumber.compare(min, currentValue) < 0 ? min : currentValue;
  }, Number.MAX_VALUE);

const optionMax = (numberOptions: O.Option<number>[]) =>
  numberOptions.reduce((max, option) => {
    const currentValue = O.getOrElse(() => Number.MIN_VALUE)(option);
    return ordNumber.compare(max, currentValue) > 0 ? max : currentValue;
  }, Number.MIN_VALUE);

const isBetween = (value: RuleValueType | number[] | string[]): Predicate<RuleValueType> => (candidate: RuleValueType) => {
  if (typeof candidate !== 'number') {
    return false;
  }

  if (!Array.isArray(value)) {
    return false;
  }

  if (isStringArray(value)) {
    const numberOptions = value.map(toNumber);

    const min = optionMin(numberOptions);
    const max = optionMax(numberOptions);

    return candidate >= min && candidate <= max;
  }

  const min = Math.min(...value);
  const max = Math.max(...value);

  return candidate >= min && candidate <= max;
};

const isNotIn = flow(isIn, not);

export const compare = (relation: Relation): ((value: RuleValueType | number[] | string[]) => Predicate<RuleValueType>) => {
  switch (relation) {
    case Relation.LESS_THAN:
      return lessThan;
    case Relation.GREATER_THAN:
      return greaterThan;
    case Relation.LESS_THAN_EQUAL:
      return lessThanEqual;
    case Relation.GREATER_THAN_EQUAL:
      return greaterThanEqual;
    case Relation.IN:
      return isIn;
    case Relation.BETWEEN:
      return isBetween;
    case Relation.NOT_EQUAL:
      return notEq;
    case Relation.NOT_IN:
      return isNotIn;
    case Relation.EQUAL:
    default:
      return eq;
  }
};
