import { Context, Data, Duration, Effect, Layer, Schedule } from 'effect';
import type { DasherInfo, LiChessChallenge, Matchup, Team } from '@/challenge/types';

export class HttpError extends Data.TaggedError('HttpError')<{ readonly message: string; readonly status?: number; readonly cause?: unknown }> {}

const jsonHeaders = { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' };

/** Lichess answers 429 when too many requests are made, in which case it asks to wait before trying again. */
const TOO_MANY_REQUESTS = 429;
const MAX_RATE_LIMIT_RETRIES = 2;

/** Teams, head-to-head scores and the own user id hardly change while challenges are processed, so they are only requested once per user for a while. */
const CACHE_TTL_MS = 60_000;

export interface LichessOptions {
  fetchImpl?: typeof fetch;
  /** How long to wait before retrying after a 429. */
  rateLimitDelay?: Duration.Input;
}

/** The parts of the lichess HTTP API this extension needs. */
export class Lichess extends Context.Service<
  Lichess,
  {
    teamsOf(username: string): Effect.Effect<Team[], HttpError>;
    /** The id of the logged-in user. */
    currentUserId: Effect.Effect<string, HttpError>;
    crosstable(username: string, otherUserId: string): Effect.Effect<Matchup, HttpError>;
    incomingChallenges: Effect.Effect<LiChessChallenge[], HttpError>;
  }
>()('team-challenge/Lichess') {
  static readonly layerFetch = (baseUrl: string, { fetchImpl = (...args) => fetch(...args), rateLimitDelay = '5 seconds' }: LichessOptions = {}) =>
    Layer.sync(Lichess, () => {
      const getJson = <A>(path: string, headers?: Record<string, string>) =>
        Effect.tryPromise({
          try: async () => {
            const response = await fetchImpl(baseUrl + path, { headers, credentials: 'same-origin' });
            if (!response.ok) {
              throw new HttpError({ message: `${response.status} ${response.statusText} for ${path}`, status: response.status });
            }
            return (await response.json()) as A;
          },
          catch: cause => (cause instanceof HttpError ? cause : new HttpError({ message: String(cause), cause })),
        }).pipe(Effect.retry({ while: error => error.status === TOO_MANY_REQUESTS, times: MAX_RATE_LIMIT_RETRIES, schedule: Schedule.spaced(rateLimitDelay) }));

      // Only successes are remembered, so a failed request is tried again next time.
      const cache = new Map<string, { at: number; value: unknown }>();
      const cached = <A>(key: string, request: Effect.Effect<A, HttpError>): Effect.Effect<A, HttpError> =>
        Effect.suspend(() => {
          const hit = cache.get(key);
          if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
            return Effect.succeed(hit.value as A);
          }
          return Effect.tap(request, value => Effect.sync(() => void cache.set(key, { at: Date.now(), value })));
        });

      return Lichess.of({
        teamsOf: username => cached(`teams:${username}`, getJson<Team[]>(`/api/team/of/${encodeURIComponent(username)}`)),
        currentUserId: cached('me', getJson<DasherInfo>('/dasher', jsonHeaders).pipe(Effect.map(info => info.user.id))),
        crosstable: (username, otherUserId) =>
          cached(`crosstable:${username}:${otherUserId}`, getJson<Matchup>(`/api/crosstable/${encodeURIComponent(username)}/${encodeURIComponent(otherUserId)}?matchup=1`)),
        incomingChallenges: getJson<{ in: LiChessChallenge[] }>('/challenge', jsonHeaders).pipe(Effect.map(response => response.in)),
      });
    });
}
