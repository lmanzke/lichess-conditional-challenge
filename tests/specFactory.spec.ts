import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { Relation } from '@/challenge/operators';
import { convertRule, encounterSpec, teamSpec } from '@/challenge/lichess';
import { DeclineReason, type Rule, type Team } from '@/challenge/types';
import { makeChallenge, runSpec } from './helpers';

const team = (id: string): Team => ({ id, name: id, nbMembers: 1 });

const rule = (overrides: Partial<Rule>): Rule => ({ condition: undefined, id: 'rating', operator: 'equal', rules: [], value: '', silent: false, ...overrides });

describe('teamSpec', () => {
  it('should work for an IN operator', async () => {
    const teamsOf = vi.fn(() => Effect.succeed([team('team1')]));
    await expect(runSpec(teamSpec('team1', Relation.IN), makeChallenge({ username: 'someone' }), { teamsOf })).resolves.toEqual({ isSatisfied: true });
    expect(teamsOf).toHaveBeenCalledWith('someone');
  });

  it('should fail for teams that do not match', async () => {
    const result = await runSpec(teamSpec('team2', Relation.IN), makeChallenge(), { teamsOf: () => Effect.succeed([team('team1')]) });
    expect(result).toEqual({ isSatisfied: false, silent: false, reason: DeclineReason.RULE_FAILED });
  });
});

describe('encounterSpec', () => {
  it('should compare against the total number of games with the current user', async () => {
    const crosstable = vi.fn(() => Effect.succeed({ nbGames: 4, users: {} }));
    const overrides = { currentUserId: Effect.succeed('me'), crosstable };

    await expect(runSpec(encounterSpec(3, Relation.GREATER_THAN), makeChallenge({ username: 'other' }), overrides)).resolves.toEqual({ isSatisfied: true });
    await expect(runSpec(encounterSpec(3, Relation.LESS_THAN), makeChallenge({ username: 'other' }), overrides)).resolves.toEqual({
      isSatisfied: false,
      silent: false,
      reason: DeclineReason.RULE_FAILED,
    });
    expect(crosstable).toHaveBeenCalledWith('other', 'me');
  });
});

describe('convertRule', () => {
  it('should decline rated rules with the matching reason and keep the silent flag', async () => {
    const result = await runSpec(convertRule(rule({ id: 'rated', value: 1, silent: true })), makeChallenge({ rated: false }));
    expect(result).toEqual({ isSatisfied: false, silent: true, reason: DeclineReason.ONLY_RATED });
  });

  it('should decline variants depending on the allowed variants', async () => {
    const challenge = makeChallenge({ variant: { key: 'atomic' } });
    expect(await runSpec(convertRule(rule({ id: 'variant', operator: 'in', value: ['standard'] })), challenge)).toMatchObject({ reason: DeclineReason.NO_VARIANTS });
    expect(await runSpec(convertRule(rule({ id: 'variant', operator: 'in', value: ['standard', 'horde'] })), challenge)).toMatchObject({ reason: DeclineReason.NOT_THIS_VARIANT });
  });

  it('should parse string values of numeric rules', async () => {
    const result = await runSpec(convertRule(rule({ id: 'rating', operator: 'between', value: ['1500', '1700'] })), makeChallenge());
    expect(result).toEqual({ isSatisfied: true });
  });

  it('should not request anything for the second operand of a satisfied OR', async () => {
    const group = rule({ condition: 'OR', rules: [rule({ operator: 'greater', value: '1000' }), rule({ id: 'team-name', value: 'x' })] });
    await expect(runSpec(convertRule(group), makeChallenge())).resolves.toEqual({ isSatisfied: true });
  });

  it('should combine AND groups, failing with the first unsatisfied rule', async () => {
    const group = rule({
      condition: 'AND',
      rules: [rule({ operator: 'greater', value: '1000' }), rule({ operator: 'less', value: '1000' }), rule({ id: 'team-name', value: 'x' })],
    });
    await expect(runSpec(convertRule(group), makeChallenge())).resolves.toMatchObject({ isSatisfied: false });
  });
});
