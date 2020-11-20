import { compare } from '@/challenge/operators';

describe('compare', function() {
  describe('LT', function() {
    it('should return true for truthy LT', function() {
      expect(compare('LT', 3)(2)).toEqual(true);
    });
    it('should return false for equal values with LT', function() {
      expect(compare('LT', 3)(3)).toEqual(false);
    });
    it('should return false for bigger values with LT', function() {
      expect(compare('LT', 3)(4)).toEqual(false);
    });
  });

  describe('LTE', function() {
    it('should return true for truthy LTE', function() {
      expect(compare('LTE', 3)(2)).toEqual(true);
    });
    it('should return true for equal values with LTE', function() {
      expect(compare('LTE', 3)(3)).toEqual(true);
    });
    it('should return false for bigger values with LTE', function() {
      expect(compare('LTE', 3)(4)).toEqual(false);
    });
  });

  describe('GT', function() {
    it('should return true for truthy GT', function() {
      expect(compare('GT', 3)(4)).toEqual(true);
    });
    it('should return false for equal values with GT', function() {
      expect(compare('GT', 3)(3)).toEqual(false);
    });
    it('should return true for bigger values with GT', function() {
      expect(compare('GT', 3)(4)).toEqual(true);
    });
  });

  describe('GTE', function() {
    it('should return true for truthy GTE', function() {
      expect(compare('GTE', 3)(4)).toEqual(true);
    });
    it('should return true for equal values with GTE', function() {
      expect(compare('GTE', 3)(3)).toEqual(true);
    });
    it('should return false for smaller values with GTE', function() {
      expect(compare('GTE', 3)(2)).toEqual(false);
    });
  });

  describe('IN', function() {
    it('should return true for containing array', function() {
      expect(compare('IN', [1, 2])(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare('IN', [1, 2])(3)).toEqual(false);
    });
    it('should return true for containing string with ;', function() {
      expect(compare('IN', '1;2')(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare('IN', '1;2')(3)).toEqual(false);
    });
  });

  describe('BETW', function() {
    it('should return true for containing array', function() {
      expect(compare('BETW', [1, 3])(1)).toEqual(true);
    });
    it('should return false for non-containing array', function() {
      expect(compare('BETW', [1, 2])(3)).toEqual(false);
    });
  });
});
