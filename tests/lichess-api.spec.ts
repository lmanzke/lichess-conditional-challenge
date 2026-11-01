import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { Lichess } from '@/challenge/lichess-api';

const challenge = (id: string) => ({
  id,
  challenger: { id: 'bob', name: 'Bob', rating: 1800, provisional: false },
  rated: true,
  variant: { key: 'standard', name: 'Standard' },
  timeControl: { type: 'clock', limit: 300, increment: 3, show: '5+3' },
  color: 'random',
  status: 'created',
});
const team = (id: string) => ({ id, name: `Team ${id}`, nbMembers: 7, description: 'ignored' });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const withLichess = <A>(fetchImpl: typeof fetch, use: (lichess: Lichess['Service']) => Effect.Effect<A, unknown>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* Lichess);
    }).pipe(Effect.provide(Lichess.layerFetch('https://lichess.test', { fetchImpl, rateLimitDelay: '1 millis' })))
  );

describe('Lichess.layerFetch', () => {
  it('should request the incoming challenges with the lichess json headers', async () => {
    const fetchImpl = vi.fn(async () => json({ in: [challenge('abc')] }));
    const challenges = await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.incomingChallenges);

    expect(challenges).toEqual([
      { id: 'abc', challenger: { id: 'bob', rating: 1800 }, rated: true, variant: { key: 'standard' }, timeControl: { type: 'clock', limit: 300, increment: 3 }, color: 'random' },
    ]);
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
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith('/dasher') ? json({ user: { id: 'me' } }) : json([team('team1')])));
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
      .mockResolvedValueOnce(json([team('team1')]));
    const teams = await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.teamsOf('bob'));

    expect(teams).toEqual([{ id: 'team1', name: 'Team team1', nbMembers: 7 }]);
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

  it('should request a single team and report a missing one with status 404', async () => {
    const fetchImpl = vi.fn(async (url: string) => (url.endsWith('/lichess-swiss') ? json(team('lichess-swiss')) : json({}, 404)));

    expect(await withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.team('lichess-swiss'))).toEqual({
      id: 'lichess-swiss',
      name: 'Team lichess-swiss',
      nbMembers: 7,
    });
    await expect(withLichess(fetchImpl as unknown as typeof fetch, lichess => lichess.team('nope'))).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledWith('https://lichess.test/api/team/lichess-swiss', expect.anything());
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  describe('responses of an unexpected shape', () => {
    const failing = (body: unknown, use: (lichess: Lichess['Service']) => Effect.Effect<unknown, unknown>) =>
      expect(withLichess((async () => json(body)) as unknown as typeof fetch, use)).rejects.toMatchObject({
        _tag: 'HttpError',
        message: expect.stringContaining('Unexpected response'),
      });

    it('should fail for a team without a name', () => failing({ id: 'x' }, lichess => lichess.team('x')));
    it('should fail if the teams of a user are not a list', () => failing({ teams: [] }, lichess => lichess.teamsOf('bob')));
    it('should fail for an account without a user id', () => failing({ user: {} }, lichess => lichess.currentUserId));
    it('should fail for a crosstable without a number of games', () => failing({ nbGames: 'many' }, lichess => lichess.crosstable('a', 'b')));
    it('should fail if the challenges are not wrapped in a list', () => failing({ in: 'none' }, lichess => lichess.incomingChallenges));
    it('should fail for html, as an error page or a login redirect would send', async () => {
      const fetchImpl = (async () => new Response('<html></html>', { status: 200 })) as unknown as typeof fetch;
      await expect(withLichess(fetchImpl, lichess => lichess.teamsOf('bob'))).rejects.toMatchObject({ _tag: 'HttpError' });
    });

    it('should not fail because of other fields, nor if a team has no member count', async () => {
      const teams = await withLichess((async () => json([{ id: 'x', name: 'X', somethingNew: true }])) as unknown as typeof fetch, lichess => lichess.teamsOf('bob'));
      expect(teams).toEqual([{ id: 'x', name: 'X' }]);
    });

    it('should skip single odd challenges and keep the others', async () => {
      const odd = { ...challenge('odd'), challenger: { id: 'bob' } };
      const challenges = await withLichess(
        (async () => json({ in: [odd, challenge('good'), 'nonsense', null] })) as unknown as typeof fetch,
        lichess => lichess.incomingChallenges
      );

      expect(challenges.map(c => c.id)).toEqual(['good']);
    });

    it('should accept the time controls lichess has besides real time', async () => {
      const unlimited = { ...challenge('u'), timeControl: { type: 'unlimited' } };
      const correspondence = { ...challenge('c'), timeControl: { type: 'correspondence', daysPerTurn: 3 } };
      const challenges = await withLichess((async () => json({ in: [unlimited, correspondence] })) as unknown as typeof fetch, lichess => lichess.incomingChallenges);

      expect(challenges.map(c => c.timeControl)).toEqual([{ type: 'unlimited' }, { type: 'correspondence', daysPerTurn: 3 }]);
    });
  });
});
