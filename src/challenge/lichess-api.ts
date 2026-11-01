import { Context, Data, Duration, Effect, Layer, Option, Schedule, Schema } from 'effect';
import {
  DasherInfoSchema,
  IncomingChallengesSchema,
  LiChessChallengeSchema,
  MatchupSchema,
  TeamSchema,
  TeamsSchema,
  type LiChessChallenge,
  type Matchup,
  type Team,
} from '@/challenge/lichess-schemas';

const decodeChallenge = Schema.decodeUnknownOption(LiChessChallengeSchema);

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
    teamsOf(username: string): Effect.Effect<ReadonlyArray<Team>, HttpError>;
    /** A single team by its id. Fails with status 404 if there is none. */
    team(id: string): Effect.Effect<Team, HttpError>;
    /** The id of the logged-in user. */
    currentUserId: Effect.Effect<string, HttpError>;
    crosstable(username: string, otherUserId: string): Effect.Effect<Matchup, HttpError>;
    incomingChallenges: Effect.Effect<ReadonlyArray<LiChessChallenge>, HttpError>;
  }
>()('team-challenge/Lichess') {
  static readonly layerFetch = (baseUrl: string, { fetchImpl = (...args) => fetch(...args), rateLimitDelay = '5 seconds' }: LichessOptions = {}) =>
    Layer.sync(Lichess, () => {
      const request = (path: string, headers?: Record<string, string>) =>
        Effect.tryPromise({
          try: async (): Promise<unknown> => {
            const response = await fetchImpl(baseUrl + path, { headers, credentials: 'same-origin' });
            if (!response.ok) {
              throw new HttpError({ message: `${response.status} ${response.statusText} for ${path}`, status: response.status });
            }
            return response.json();
          },
          catch: cause => (cause instanceof HttpError ? cause : new HttpError({ message: String(cause), cause })),
        }).pipe(Effect.retry({ while: error => error.status === TOO_MANY_REQUESTS, times: MAX_RATE_LIMIT_RETRIES, schedule: Schedule.spaced(rateLimitDelay) }));

      /** Requests JSON and checks that it has the shape the schema describes. Anything else fails instead of being trusted. */
      const getJson = <S extends Schema.Constraint & { readonly DecodingServices: never }>(
        path: string,
        schema: S,
        headers?: Record<string, string>
      ): Effect.Effect<S['Type'], HttpError> =>
        request(path, headers).pipe(
          Effect.flatMap(body =>
            Schema.decodeUnknownEffect(schema)(body).pipe(Effect.mapError(error => new HttpError({ message: `Unexpected response for ${path}: ${error.message}`, cause: error })))
          )
        );

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
        team: id => cached(`team:${id}`, getJson(`/api/team/${encodeURIComponent(id)}`, TeamSchema)),
        teamsOf: username => cached(`teams:${username}`, getJson(`/api/team/of/${encodeURIComponent(username)}`, TeamsSchema)),
        currentUserId: cached('me', getJson('/dasher', DasherInfoSchema, jsonHeaders).pipe(Effect.map(info => info.user.id))),
        crosstable: (username, otherUserId) =>
          cached(`crosstable:${username}:${otherUserId}`, getJson(`/api/crosstable/${encodeURIComponent(username)}/${encodeURIComponent(otherUserId)}?matchup=1`, MatchupSchema)),
        incomingChallenges: getJson('/challenge', IncomingChallengesSchema, jsonHeaders).pipe(
          Effect.flatMap(response => {
            // One odd challenge must not hide all the others, so they are read one by one.
            const challenges = response.in
              .map(raw => decodeChallenge(raw))
              .filter(Option.isSome)
              .map(option => option.value);
            const skipped = response.in.length - challenges.length;
            return skipped === 0 ? Effect.succeed(challenges) : Effect.as(Effect.logWarning(`Ignoring ${skipped} challenge(s) with an unexpected shape`), challenges);
          })
        ),
      });
    });
}
