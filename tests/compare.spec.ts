import { compare, lessThan, numberComparison, ordOptionNumber, Relation, toNumber } from '@/challenge/operators';
import { some } from 'fp-ts/Option';
import { ordNumber } from 'fp-ts/Ord';

describe('toNumber', function() {
  it('should work for numbers', function() {
    expect(toNumber(3)).toEqual(some(3));
  });
});

describe('ordNumber', function() {
  it('should return 1 for bigger second number', function() {
    expect(ordNumber.compare(1, 2)).toEqual(-1);
  });
});

describe('numberComparison', function() {
  it('should work for a custom predicate', function() {
    expect(numberComparison(v => v === -1)(3)(2)).toEqual(true);
  });
});

describe('ordOptionNumber', function() {
  it('should return -1 for two somes with smaller first', function() {
    expect(ordOptionNumber.compare(some(2), some(3))).toEqual(-1);
  });
});

describe('lessThan', function() {
  it('should return true for two numbers', function() {
    expect(lessThan(3)(2)).toEqual(true);
  });
});

describe('compare', function() {
  describe('LT', function() {
    it('should return true for truthy LT', function() {
      expect(compare(Relation.LESS_THAN)(3)(2)).toEqual(true);
    });
    it('should return false for equal values with LT', function() {
      expect(compare(Relation.LESS_THAN)(3)(3)).toEqual(false);
    });
    it('should return false for bigger values with LT', function() {
      expect(compare(Relation.LESS_THAN)(3)(4)).toEqual(false);
    });
  });

  describe('LTE', function() {
    it('should return true for truthy LTE', function() {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(2)).toEqual(true);
    });
    it('should return true for equal values with LTE', function() {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(3)).toEqual(true);
    });
    it('should return false for bigger values with LTE', function() {
      expect(compare(Relation.LESS_THAN_EQUAL)(3)(4)).toEqual(false);
    });
  });

  describe('GT', function() {
    it('should return true for truthy GT', function() {
      expect(compare(Relation.GREATER_THAN)(3)(4)).toEqual(true);
    });
    it('should return false for equal values with GT', function() {
      expect(compare(Relation.GREATER_THAN)(3)(3)).toEqual(false);
    });
    it('should return true for bigger values with GT', function() {
      expect(compare(Relation.GREATER_THAN)(3)(4)).toEqual(true);
    });
  });

  describe('GTE', function() {
    it('should return true for truthy GTE', function() {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(4)).toEqual(true);
    });
    it('should return true for equal values with GTE', function() {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(3)).toEqual(true);
    });
    it('should return false for smaller values with GTE', function() {
      expect(compare(Relation.GREATER_THAN_EQUAL)(3)(2)).toEqual(false);
    });
  });

  describe('IN', function() {
    it('should return true for containing array', function() {
      expect(compare(Relation.IN)([1, 2])(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare(Relation.IN)([1, 2])(3)).toEqual(false);
    });
    it('should return true for containing string with ;', function() {
      expect(compare(Relation.IN)('1;2')(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare(Relation.IN)('1;2')(3)).toEqual(false);
    });
  });

  describe('NOT IN', function() {
    it('should return true for not-containing array', function() {
      expect(compare(Relation.NOT_IN)([1, 2])(3)).toEqual(true);
    });
    it('should return false for containing array', function() {
      expect(compare(Relation.NOT_IN)([1, 2])(1)).toEqual(false);
    });
    it('should return false for containing string with ;', function() {
      expect(compare(Relation.NOT_IN)('1;2')(1)).toEqual(false);
    });
    it('should return true for non-containing array', function() {
      expect(compare(Relation.NOT_IN)('1;2')(3)).toEqual(true);
    });
  });

  describe('BETW', function() {
    it('should return true for containing array', function() {
      expect(compare(Relation.BETWEEN)([1, 3])(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare(Relation.BETWEEN)([1, 2])(3)).toEqual(false);
    });
  });
});
