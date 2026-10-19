import { Context, Data, Effect, Layer } from 'effect';
import type { DasherInfo, LiChessChallenge, Matchup, Team } from '@/challenge/types';

export class HttpError extends Data.TaggedError('HttpError')<{ readonly message: string; readonly cause?: unknown }> {}

const jsonHeaders = { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' };

/** The parts of the lichess HTTP API this extension needs. */
export class Lichess extends Context.Service<
  Lichess,
  {
    teamsOf(username: string): Effect.Effect<Team[], HttpError>;
    /** The id of the logged-in user. Only requested once. */
    currentUserId: Effect.Effect<string, HttpError>;
    crosstable(username: string, otherUserId: string): Effect.Effect<Matchup, HttpError>;
    incomingChallenges: Effect.Effect<LiChessChallenge[], HttpError>;
  }
>()('team-challenge/Lichess') {
  static readonly layerFetch = (baseUrl: string, fetchImpl: typeof fetch = (...args) => fetch(...args)) =>
    Layer.effect(
      Lichess,
      Effect.gen(function* () {
        const getJson = <A>(path: string, headers?: Record<string, string>) =>
          Effect.tryPromise({
            try: async () => {
              const response = await fetchImpl(baseUrl + path, { headers, credentials: 'same-origin' });
              if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText} for ${path}`);
              }
              return (await response.json()) as A;
            },
            catch: cause => new HttpError({ message: String(cause), cause }),
          });

        const currentUserId = yield* Effect.cached(getJson<DasherInfo>('/dasher', jsonHeaders).pipe(Effect.map(info => info.user.id)));

        return Lichess.of({
          teamsOf: username => getJson<Team[]>(`/api/team/of/${username}`),
          currentUserId,
          crosstable: (username, otherUserId) => getJson<Matchup>(`/api/crosstable/${username}/${otherUserId}?matchup=1`),
          incomingChallenges: getJson<{ in: LiChessChallenge[] }>('/challenge', jsonHeaders).pipe(Effect.map(response => response.in)),
        });
      })
    );
}
