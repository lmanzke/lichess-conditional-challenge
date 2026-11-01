import { Effect } from 'effect';
import { Lichess } from '@/challenge/lichess-api';

export type TeamLookup =
  { readonly status: 'found'; readonly id: string; readonly name: string; readonly members: number } | { readonly status: 'missing' } | { readonly status: 'unknown' };

/** Lichess team ids are the names in lowercase, with every run of other characters replaced by a hyphen. */
export const slugify = (name: string): string =>
  name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const lookup = (id: string): Effect.Effect<TeamLookup, never, Lichess> =>
  Effect.gen(function* () {
    const lichess = yield* Lichess;
    return yield* lichess.team(id).pipe(
      Effect.map((team): TeamLookup => ({ status: 'found', id: team.id, name: team.name, members: team.nbMembers })),
      Effect.catch(error => Effect.succeed<TeamLookup>(error.status === 404 ? { status: 'missing' } : { status: 'unknown' }))
    );
  });

export interface TeamCheck {
  readonly input: string;
  readonly result: TeamLookup;
  /** The team the input most likely means, if the input itself is not the id of a team. */
  readonly suggestion?: Extract<TeamLookup, { status: 'found' }>;
}

/**
 * Checks if a team exists on lichess. Rules compare against the team id, so typing the display name ("Lichess Swiss")
 * or a different case never matches. In that case the id it most likely stands for is suggested.
 */
export const checkTeam = (input: string): Effect.Effect<TeamCheck, never, Lichess> =>
  Effect.gen(function* () {
    const result = yield* lookup(input);
    if (result.status === 'found') {
      return result.id === input ? { input, result } : { input, result, suggestion: result };
    }

    const slug = slugify(input);
    if (result.status === 'missing' && slug !== '' && slug !== input) {
      const bySlug = yield* lookup(slug);
      if (bySlug.status === 'found') {
        return { input, result, suggestion: bySlug };
      }
    }
    return { input, result };
  });
