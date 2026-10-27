import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { Lichess } from '@/challenge/lichess-api';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const withLichess = <A>(fetchImpl: typeof fetch, use: (lichess: Lichess['Service']) => Effect.Effect<A, unknown>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* Lichess);
    }).pipe(Effect.provide(Lichess.layerFetch('https://lichess.test', { fetchImpl, rateLimitDelay: '1 millis' })))
  );

describe('Lichess.layerFetch', () => {
  it('should request the incoming challenges with the lichess json headers', async () => {
    const fetchImpl = vi.fn(async () => json({ in: [{ id: 'abc' }] }));
    const challenges = await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.incomingChallenges);

    expect(challenges).toEqual([{ id: 'abc' }]);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://lichess.test/challenge',
      expect.objectContaining({ headers: { accept: 'application/vnd.lichess.v5+json', 'x-requested-with': 'XMLHttpRequest' } })
    );
  });

  it('should encode usernames in paths', async () => {
    const fetchImpl = vi.fn(async () => json([]));
    await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.teamsOf('a/b?c'));

    expect(fetchImpl.mock.calls[0]).toContain('https://lichess.test/api/team/of/a%2Fb%3Fc');
  });

  it('should only request teams and the own id once per user', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith('/dasher') ? json({ user: { id: 'me' } }) : json([{ id: 'team1' }])));
    const calls = await withLichess(fetchImpl as unknown as typeof fetch, lichess =>
      Effect.gen(function* () {
        yield* lichess.teamsOf('bob');
        yield* lichess.teamsOf('bob');
        yield* lichess.teamsOf('alice');
        yield* lichess.currentUserId;
        yield* lichess.currentUserId;
        return fetchImpl.mock.calls.map(([url]) => url);
      })
    );

    expect(calls).toEqual(['https://lichess.test/api/team/of/bob', 'https://lichess.test/api/team/of/alice', 'https://lichess.test/dasher']);
  });

  it('should retry after a 429', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json([{ id: 'team1' }]));
    const teams = await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.teamsOf('bob'));

    expect(teams).toEqual([{ id: 'team1' }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('should give up after repeated 429s and not retry other errors', async () => {
    const limited = vi.fn(async () => json({}, 429));
    await expect(withLichess(limited as unknown as typeof fetch, lichess => lichess.teamsOf('bob'))).rejects.toMatchObject({ status: 429 });
    expect(limited).toHaveBeenCalledTimes(3);

    const broken = vi.fn(async () => json({}, 500));
    await expect(withLichess(broken as unknown as typeof fetch, lichess => lichess.teamsOf('bob'))).rejects.toMatchObject({ status: 500 });
    expect(broken).toHaveBeenCalledTimes(1);
  });

  it('should not remember failures', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({}, 500)).mockResolvedValueOnce(json([]));
    const result = await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.teamsOf('bob').pipe(Effect.ignore, Effect.andThen(lichess.teamsOf('bob'))));

    expect(result).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
