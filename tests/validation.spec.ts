import { describe, expect, it } from 'vitest';
import { countIssues, newGroup, newRule, ruleIssue } from '@/options/filters';
import type { Rule } from '@/challenge/types';

const rule = (overrides: Partial<Rule>): Rule => ({ ...newRule(), ...overrides });

describe('ruleIssue', () => {
  it('should accept the rules a user starts with', () => {
    expect(ruleIssue(newRule())).toBeUndefined();
    expect(ruleIssue(newGroup())).toBeUndefined();
  });

  it('should find empty groups', () => {
    expect(ruleIssue({ ...newGroup(), rules: [] })).toBe('emptyGroup');
  });

  it('should find choices without any selection', () => {
    expect(ruleIssue(rule({ id: 'variant', operator: 'in', value: [] }))).toBe('noChoice');
    expect(ruleIssue(rule({ id: 'variant', operator: 'in', value: ['atomic'] }))).toBeUndefined();
  });

  it('should find empty text values, also in lists', () => {
    expect(ruleIssue(rule({ id: 'team-name', operator: 'equal', value: '  ' }))).toBe('emptyValue');
    expect(ruleIssue(rule({ id: 'user-id', operator: 'in', value: ' ; ' }))).toBe('emptyValue');
    expect(ruleIssue(rule({ id: 'user-id', operator: 'in', value: 'a;b' }))).toBeUndefined();
  });

  it('should find reversed ranges', () => {
    expect(ruleIssue(rule({ id: 'rating', operator: 'between', value: [1800, 1200] }))).toBe('rangeReversed');
    expect(ruleIssue(rule({ id: 'rating', operator: 'between', value: [1200, 1800] }))).toBeUndefined();
  });
});

describe('countIssues', () => {
  it('should count the problems in the whole tree', () => {
    const tree: Rule = { ...newGroup(), rules: [rule({ id: 'team-name', operator: 'equal', value: '' }), { ...newGroup(), rules: [] }, newRule()] };
    expect(countIssues(tree)).toBe(2);
  });
});
