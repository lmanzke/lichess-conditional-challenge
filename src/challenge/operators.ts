import { Option, Order, Predicate } from 'effect';
import type { RuleValueType } from '@/challenge/types';

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

type Candidate = RuleValueType;
type Comparand = RuleValueType | number[] | string[];
type Comparison = (value: Comparand) => Predicate.Predicate<Candidate>;

export const ordOptionNumber = Option.makeOrder(Order.Number);

export const toNumber = (value: Candidate | undefined | null): Option.Option<number> => {
  if (value === undefined || value === null || typeof value === 'boolean' || Array.isArray(value)) {
    return Option.none();
  }

  const parsed = typeof value === 'number' ? value : parseFloat(value);

  return Number.isNaN(parsed) ? Option.none() : Option.some(parsed);
};

/** Applies `predicate` to the ordering of the candidate relative to the value. */
export const numberComparison =
  (predicate: Predicate.Predicate<-1 | 0 | 1>) =>
  (value: Comparand): Predicate.Predicate<Candidate> =>
  candidate => {
    if (Array.isArray(value) || typeof value === 'boolean' || typeof candidate === 'boolean') {
      return false;
    }

    return predicate(ordOptionNumber(toNumber(candidate), toNumber(value)));
  };

const eq =
  <A>(value: A): Predicate.Predicate<A> =>
  candidate =>
    value === candidate;
const notEq = (value: Comparand): Predicate.Predicate<Candidate> => Predicate.not(eq<unknown>(value));

export const lessThan = numberComparison(order => order === -1);
export const greaterThan = numberComparison(order => order === 1);
export const lessThanEqual = (value: Comparand) => Predicate.not(greaterThan(value));
export const greaterThanEqual = (value: Comparand) => Predicate.not(lessThan(value));

const isStringArray = (value: unknown[]): value is string[] => value.every(Predicate.isString);
const isNumberArray = (value: unknown[]): value is number[] => value.every(Predicate.isNumber);

const isIn: Comparison = value => candidate => {
  if (typeof value === 'number' || typeof value === 'boolean' || typeof candidate === 'boolean') {
    return false;
  }

  const values = typeof value === 'string' ? value.split(';') : value;

  if (isNumberArray(values)) {
    const candidateNumber = toNumber(candidate);
    return values.some(v => Option.isSome(candidateNumber) && candidateNumber.value === v);
  }

  return values.includes(candidate.toString());
};

const isBetween: Comparison = value => candidate => {
  if (typeof candidate !== 'number' || !Array.isArray(value)) {
    return false;
  }

  const numbers = isStringArray(value)
    ? value
        .map(toNumber)
        .filter(Option.isSome)
        .map(o => o.value)
    : value;

  return candidate >= Math.min(...numbers) && candidate <= Math.max(...numbers);
};

const isNotIn: Comparison = value => Predicate.not(isIn(value));

export const compare = (relation: Relation): Comparison => {
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
