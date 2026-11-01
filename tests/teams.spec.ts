import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/challenge/lichess-api';
import { checkTeam, slugify } from '@/challenge/teams';
import type { Team } from '@/challenge/types';
import { lichessLayer } from './helpers';

const team = (id: string, name: string): Team => ({ id, name, nbMembers: 42 });

/** A lichess that only knows these teams. */
const knowing = (...teams: Team[]) =>
  vi.fn((id: string) => (teams.find(t => t.id === id) ? Effect.succeed(teams.find(t => t.id === id) as Team) : Effect.fail(new HttpError({ message: '404', status: 404 }))));

const run = (input: string, team: (id: string) => Effect.Effect<Team, HttpError>) => Effect.runPromise(checkTeam(input).pipe(Effect.provide(lichessLayer({ team }))));

describe('slugify', () => {
  it('should build team ids from names like lichess', () => {
    expect(slugify('Lichess Swiss')).toBe('lichess-swiss');
    expect(slugify('  Schach & Spaß!! ')).toBe('schach-spa');
    expect(slugify('Équipe Française')).toBe('equipe-francaise');
    expect(slugify('---')).toBe('');
  });
});

describe('checkTeam', () => {
  const swiss = team('lichess-swiss', 'Lichess Swiss');

  it('should find a team by its id', async () => {
    expect(await run('lichess-swiss', knowing(swiss))).toEqual({ input: 'lichess-swiss', result: { status: 'found', id: 'lichess-swiss', name: 'Lichess Swiss', members: 42 } });
  });

  it('should suggest the id when the display name was typed', async () => {
    const check = await run('Lichess Swiss', knowing(swiss));

    expect(check.result.status).toBe('missing');
    expect(check.suggestion).toMatchObject({ id: 'lichess-swiss', name: 'Lichess Swiss' });
  });

  it('should suggest the real id if lichess finds the team under a different case', async () => {
    const check = await run('Lichess-Swiss', () => Effect.succeed(swiss));
    expect(check.suggestion?.id).toBe('lichess-swiss');
  });

  it('should report teams that do not exist, without suggestion', async () => {
    const check = await run('no such team', knowing(swiss));
    expect(check).toEqual({ input: 'no such team', result: { status: 'missing' } });
  });

  it('should not claim a team is missing when lichess could not be reached', async () => {
    const check = await run('lichess-swiss', () => Effect.fail(new HttpError({ message: 'offline' })));
    expect(check.result).toEqual({ status: 'unknown' });
  });
});
