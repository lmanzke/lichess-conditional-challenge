import { Array, Option } from 'effect';

export const ensureNonEmptyArray = <T>(items: T[]): Option.Option<Array.NonEmptyArray<T>> => (Array.isArrayNonEmpty(items) ? Option.some(items) : Option.none());
