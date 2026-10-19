import { describe, expect, it } from 'vitest';
import { extractNumEncounters } from '@/challenge/lichess';

describe('extractNumEncounters', () => {
  it('should use the total and the matchup of the day', () => {
    expect(extractNumEncounters({ nbGames: 5, users: { a: 3, b: 2 }, matchup: { nbGames: 2, users: { a: 1, b: 1 } } })).toEqual({ total: 5, today: 2 });
  });

  it('should count no encounters today without a matchup', () => {
    expect(extractNumEncounters({ nbGames: 3, users: {} })).toEqual({ total: 3, today: 0 });
  });
});
