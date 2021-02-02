import { HKT, Kind2, Kind3, URIS, URIS2, URIS3 } from 'fp-ts/HKT';
import { MonadTask, MonadTask2, MonadTask3 } from 'fp-ts/MonadTask';

export const wait = <M extends URIS>(m: MonadTask<M>) => (ms: number) => <A>(task: HKT<M, A>): HKT<M, A> =>
  m.chain(
    m.fromTask(
      () =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        })
    ),
    () => task
  );

export const wait2 = <M extends URIS2>(m: MonadTask2<M>) => (ms: number) => <A, B>(task: Kind2<M, A, B>): Kind2<M, A, B> =>
  m.chain(
    m.fromTask(
      () =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        })
    ),
    () => task
  );

export const wait3 = <M extends URIS3>(m: MonadTask3<M>) => (ms: number) => <A, B, C>(task: Kind3<M, A, B, C>): Kind3<M, A, B, C> =>
  m.chain(
    m.fromTask(
      () =>
        new Promise(resolve => {
          setTimeout(resolve, ms);
        })
    ),
    () => task
  );
