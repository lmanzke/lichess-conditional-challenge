import { Spec } from '@/challenge/lichess';

export const andSpec = (spec1: Spec, spec2: Spec): Spec => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (!firstResult) {
      return false;
    }
    return spec2.isSatisfied(challenge);
  },
});

export const orSpec = (spec1: Spec, spec2: Spec): Spec => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (firstResult) {
      return true;
    }
    return spec2.isSatisfied(challenge);
  },
});

export const notSpec = (spec1: Spec): Spec => ({
  isSatisfied: async challenge => {
    const result = await spec1.isSatisfied(challenge);

    return !result;
  },
});

export const applyCondition = (operator: string, spec1: Spec, spec2: Spec): Spec => {
  switch (operator) {
    case 'AND':
      return andSpec(spec1, spec2);
    case 'OR':
    default:
      return orSpec(spec1, spec2);
  }
};

export const anySpec: Spec = {
  isSatisfied: async _challenge => true,
};
