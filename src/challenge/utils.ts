import { Option, Array } from 'effect';
import type { NonEmptyArray } from 'effect/Array';

export const ensureNonEmptyArray = <T>(arr1: T[]): Option.Option<Array.NonEmptyArray<T>> => {
    if (arr1.length > 0) {
        return Option.some(arr1 as NonEmptyArray<T>);
    }

    return Option.none();
}