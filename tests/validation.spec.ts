import { describe, expect, it } from 'vitest';
import { clampNumber, countIssues, findFilter, newGroup, newRule, ruleIssue } from '@/options/filters';
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

describe('numbers', () => {
  it('should reject values below zero for ratings and counts', () => {
    for (const id of ['rating', 'encounters', 'encountersToday', 'limitSeconds', 'incrementSeconds']) {
      expect(ruleIssue(rule({ id, operator: 'greater', value: -1 }))).toBe('belowMinimum');
      expect(ruleIssue(rule({ id, operator: 'greater', value: 0 }))).toBeUndefined();
    }
    expect(ruleIssue(rule({ id: 'rating', operator: 'between', value: [-5, 10] }))).toBe('belowMinimum');
  });

  it('should reject fractions', () => {
    expect(ruleIssue(rule({ id: 'rating', operator: 'greater', value: 1500.5 }))).toBe('notInteger');
  });
});

describe('clampNumber', () => {
  it('should round and keep numbers within the minimum', () => {
    const rating = findFilter('rating');
    expect(clampNumber(rating, -20)).toBe(0);
    expect(clampNumber(rating, 1500.6)).toBe(1501);
    expect(clampNumber(rating, Number.NaN)).toBe(0);
  });
});
