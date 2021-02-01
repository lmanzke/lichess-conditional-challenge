import { fromArray, NonEmptyArray } from 'fp-ts/NonEmptyArray';
import { flow, pipe } from 'fp-ts/function';
import { getRefinement } from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { sequenceT } from 'fp-ts/Apply';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { ReaderTypeOf } from '@/challenge/types';
import { AxiosInstance } from 'axios';
import * as IO from 'fp-ts/IO';

export const sum = (a: number, b: number): number => a + b;
export const sumArray = (arr: number[]): number => arr.reduce(sum, 0);

export interface SplitCollection<T> {
  current: T | null;
  other: T[];
}

export interface SafeSplitCollection<T> {
  current: T;
  other: T[];
}

export const isNonEmptyArray = getRefinement(fromArray);

export interface Splitter {
  <T>(elements: T[]): SplitCollection<T>;
}

export interface SafeSplitter {
  <T>(elements: NonEmptyArray<T>): SafeSplitCollection<T>;
}

const separateIndex = <T>(elements: T[], index: number): SplitCollection<T> => {
  if (elements.length === 0) {
    return { current: null, other: [] };
  }

  if (index > elements.length - 1) {
    return { current: null, other: elements };
  }

  return {
    current: elements[index],
    other: elements.filter((_v, i) => i !== index),
  };
};

const safeSeparateIndex = <T>(elements: NonEmptyArray<T>, index: number): SafeSplitCollection<T> => {
  if (index > elements.length - 1) {
    index = elements.length - 1;
  }

  return {
    current: elements[index],
    other: elements.filter((_v, i) => i !== index),
  };
};

export const safeRandomElement: SafeSplitter = <T>(elements: NonEmptyArray<T>): SafeSplitCollection<T> => {
  const index = Math.floor(Math.random() * elements.length);

  return safeSeparateIndex(elements, index);
};

export const splitRandomElement: Splitter = <T>(elements: T[]): SplitCollection<T> => {
  const index = Math.floor(Math.random() * elements.length);

  return separateIndex(elements, index);
};

export const headTail: Splitter = <T>(elements: T[]): SplitCollection<T> => separateIndex(elements, 0);
export const safeHeadTail: SafeSplitter = <T>(elements: NonEmptyArray<T>) => safeSeparateIndex(elements, 0);

export function ensureNonEmptyArray<T>(ts: T[]): E.Either<Error, NonEmptyArray<T>> {
  return pipe(
    ts,
    fromArray,
    E.fromOption(() => Error('No elements'))
  );
}

export function ensureNonEmptyArrayReader<T>(ts: T[]): ReaderTypeOf<NonEmptyArray<T>> {
  return pipe(ts, ensureNonEmptyArray, RTE.fromEither);
}

export const sequenceReaderTaskEither = sequenceT(RTE.readerTaskEither);
export const ofSpecReader: <A>(_v: A) => RTE.ReaderTaskEither<AxiosInstance, Error, A> = <A>(v: A) => RTE.of<AxiosInstance, Error, A>(v);
export const fromIOSpecReader: <A>(_v: IO.IO<A>) => RTE.ReaderTaskEither<AxiosInstance, Error, A> = <A>(v: IO.IO<A>) => RTE.fromIO<AxiosInstance, Error, A>(v);
export const unknownError = flow(String, Error);
