import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { fields, findField } from '@/challenge/fields';
import { addChild, newGroup, newRule, removeChild, replaceChild, ruleIssue, setCombinator, setField, setRelation, setSilent, settleRange } from '@/challenge/rule-tree';
import { convertRule } from '@/challenge/spec';
import { isRuleGroup } from '@/challenge/types';
import { makeChallenge, runSpec } from './helpers';

describe('every field', () => {
  const challenge = makeChallenge();
  const lichess = {
    teamsOf: () => Effect.succeed([]),
    currentUserId: Effect.succeed('me'),
    crosstable: () => Effect.succeed({ nbGames: 0, users: {} }),
  };

  it.each(fields.map(field => field.id))('%s should start with a rule that can be evaluated', async id => {
    const rule = newRule(id);

    // Fields that need typing or a choice start with a warning, anything else starts fine.
    expect([undefined, 'emptyValue', 'noChoice']).toContain(ruleIssue(rule));
    expect(findField(id).relations).toContain(rule.relation);
    await expect(runSpec(convertRule(rule), challenge, lichess)).resolves.toHaveProperty('isSatisfied');
  });
});

describe('editing a rule tree', () => {
  it('should start another field over, keeping only the silent flag', () => {
    const rule = setSilent({ ...newRule('rating'), value: 1800 }, true);

    expect(setField(rule, 'variant')).toEqual({ ...newRule('variant'), silent: true });
  });

  it('should reset the value to one that fits a new relation', () => {
    const rule = newRule('rating');

    expect(setRelation(rule, 'between').value).toEqual([1200, 1800]);
    expect(setRelation(rule, 'greater').value).toBe(1500);
  });

  it('should round the numbers of a range to the allowed minimum', () => {
    expect(settleRange(newRule('encounters'), [-4, '7.4']).value).toEqual([0, 7]);
  });

  it('should add, replace and remove children without changing the original', () => {
    const group = newGroup();
    const added = addChild(group, newRule('rated'));
    const replaced = replaceChild(added, 0, newRule('variant'));
    const removed = removeChild(replaced, 1);

    expect(group.children).toHaveLength(1);
    expect(added.children).toHaveLength(2);
    expect(replaced.children[0]).toEqual(newRule('variant'));
    expect(removed.children).toEqual([newRule('variant')]);
    expect(isRuleGroup(setCombinator(group, 'OR'))).toBe(true);
    expect(setCombinator(group, 'OR').combinator).toBe('OR');
  });
});
