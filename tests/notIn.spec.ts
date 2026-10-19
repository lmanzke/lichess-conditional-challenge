import { describe, expect, it } from 'vitest';
import { DeclineReason, type Rule } from '@/challenge/types';
import { convertRule } from '@/challenge/lichess';
import { makeChallenge, runSpec } from './helpers';

const notInRule: Rule = { condition: undefined, id: 'user-id', operator: 'not_in', rules: [], value: 'user-1;user2', silent: false };

describe('not in spec', () => {
  it('should return false for not in with blacklisted user', async () => {
    const challenge = makeChallenge({ challenger: { rating: 1600, id: 'user-1' } });
    await expect(runSpec(convertRule(notInRule), challenge)).resolves.toEqual({ isSatisfied: false, reason: DeclineReason.RULE_FAILED, silent: false });
  });

  it('should return true for not in with not blacklisted user', async () => {
    const challenge = makeChallenge({ challenger: { rating: 1600, id: 'user-3' } });
    await expect(runSpec(convertRule(notInRule), challenge)).resolves.toEqual({ isSatisfied: true });
  });
});
