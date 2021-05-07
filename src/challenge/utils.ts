import { fromArray, NonEmptyArray } from 'fp-ts/NonEmptyArray';
import { Endomorphism, flow, pipe } from 'fp-ts/function';
import { getRefinement } from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import { sequenceT } from 'fp-ts/Apply';
import * as RTE from 'fp-ts/ReaderTaskEither';
import { ReaderTypeOf } from '@/challenge/types';
import { AxiosInstance } from 'axios';
import * as IO from 'fp-ts/IO';
import * as TE from 'fp-ts/TaskEither';
import { Kind, Kind2, Kind3, URIS, URIS2, URIS3 } from 'fp-ts/HKT';
import { MonadIO1, MonadIO2, MonadIO3 } from 'fp-ts/MonadIO';

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

export const isDevMode = (): boolean => !('update_url' in chrome.runtime.getManifest());

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

export const tap = <M extends URIS>(hkt: MonadIO1<M>) => <A>(f: (a: A) => void): Endomorphism<Kind<M, A>> => (fa: Kind<M, A>) =>
  hkt.chain(fa, v =>
    hkt.fromIO(() => {
      f(v);
      return v;
    })
  );

export const tap2 = <M extends URIS2>(hkt: MonadIO2<M>) => <A, B>(f: (a: B) => void): Endomorphism<Kind2<M, A, B>> => (fa: Kind2<M, A, B>) =>
  hkt.chain(fa, v =>
    hkt.fromIO(() => {
      f(v);
      return v;
    })
  );

export const tap3 = <M extends URIS3>(hkt: MonadIO3<M>) => <A, B, C>(f: (a: C) => void): Endomorphism<Kind3<M, A, B, C>> => (fa: Kind3<M, A, B, C>) =>
  hkt.chain(fa, v =>
    hkt.fromIO(() => {
      f(v);
      return v;
    })
  );

export function memoizeTaskEither<A>(ma: TE.TaskEither<Error, A>): TE.TaskEither<Error, A> {
  let cache: E.Either<Error, A>;
  let done = false;
  return () =>
    new Promise((resolve, reject) => {
      if (!done) {
        ma()
          .then(result => {
            cache = result;
            done = true;
            resolve(result);
          })
          .catch(reject);
      } else {
        resolve(cache);
      }
    });
}

export function memoizeReaderTaskEither<R, A>(ma: RTE.ReaderTaskEither<R, Error, A>): RTE.ReaderTaskEither<R, Error, A> {
  let cache: E.Either<Error, A>;
  let done = false;
  return r => () =>
    new Promise((resolve, reject) => {
      if (!done) {
        ma(r)()
          .then(result => {
            cache = result;
            done = true;
            resolve(result);
          })
          .catch(reject);
      } else {
        resolve(cache);
      }
    });
}
