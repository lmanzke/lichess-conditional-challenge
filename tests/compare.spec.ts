import { compare, lessThan, numberComparison, ordOptionNumber, Relation, toNumber } from '@/challenge/operators';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

describe('toNumber', () => {
  it('should work for numbers', () => {
    expect(toNumber(3)).toEqual(Option.some(3));
  });

  it('should work for non-numbers', () => {
    expect(toNumber('a')).toEqual(Option.none());
  });
});

describe('numberComparison', () => {
  it('should work for a custom predicate', () => {
    expect(numberComparison(v => v === -1)(3)(2)).toEqual(true);
  });
});

describe('ordOptionNumber', () => {
  it('should return -1 for two somes with smaller first', () => {
    expect(ordOptionNumber(Option.some(2), Option.some(3))).toEqual(-1);
  });
});

describe('lessThan', () => {
  it('should return true for two numbers', () => {
    expect(lessThan(3)(2)).toEqual(true);
  });
});

describe('compare', () => {
  describe('LT', () => {
    it('should return true for truthy LT', () => {
      expect(compare(Relation.LESS_THAN)(3)(2)).toEqual(true);
    });
    it('should return false for equal values with LT', () => {
      expect(compare(Relation.LESS_THAN)(3)(3)).toEqual(false);
    });
    it('should return false for bigger values with LT', () => {
      expect(compare(Relation.LESS_THAN)(3)(4)).toEqual(false);
    });
  });

  describe('LTE', () => {
    it('should return true for truthy LTE', () => {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(2)).toEqual(true);
    });
    it('should return true for equal values with LTE', () => {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(3)).toEqual(true);
    });
    it('should return false for bigger values with LTE', () => {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(4)).toEqual(false);
    });
  });

  describe('GT', () => {
    it('should return true for truthy GT', () => {
      expect(compare(Relation.GREATER_THAN)(3)(4)).toEqual(true);
    });
    it('should return false for equal values with GT', () => {
      expect(compare(Relation.GREATER_THAN)(3)(3)).toEqual(false);
    });
    it('should return true for bigger values with GT', () => {
      expect(compare(Relation.GREATER_THAN)(3)(4)).toEqual(true);
    });
  });

  describe('GTE', () => {
    it('should return true for truthy GTE', () => {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(4)).toEqual(true);
    });
    it('should return true for equal values with GTE', () => {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(3)).toEqual(true);
    });
    it('should return false for smaller values with GTE', () => {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(2)).toEqual(false);
    });
  });

  describe('IN', () => {
    it('should return true for containing array', () => {
      expect(compare(Relation.IN)([1, 2])(1)).toEqual(true);
    });
    it('should return false for non-containing array', () => {
      expect(compare(Relation.IN)([1, 2])(3)).toEqual(false);
    });
    it('should return true for containing string with ;', () => {
      expect(compare(Relation.IN)('1;2')(1)).toEqual(true);
    });
    it('should return false for non-containing array', () => {
      expect(compare(Relation.IN)('1;2')(3)).toEqual(false);
    });
  });

  describe('NOT IN', () => {
    it('should return true for not-containing array', () => {
      expect(compare(Relation.NOT_IN)([1, 2])(3)).toEqual(true);
    });
    it('should return false for containing array', () => {
      expect(compare(Relation.NOT_IN)([1, 2])(1)).toEqual(false);
    });
    it('should return false for containing string with ;', () => {
      expect(compare(Relation.NOT_IN)('1;2')(1)).toEqual(false);
    });
    it('should return true for non-containing array', () => {
      expect(compare(Relation.NOT_IN)('1;2')(3)).toEqual(true);
    });
  });

  describe('BETW', () => {
    it('should return true for containing array', () => {
      expect(compare(Relation.BETWEEN)([1, 3])(1)).toEqual(true);
    });
    it('should return false for non-containing array', () => {
      expect(compare(Relation.BETWEEN)([1, 2])(3)).toEqual(false);
    });
  });
});
