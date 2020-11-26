import { encounterSpecFactory, ratedSpec, ratingSpec, Spec, teamSpecFactory, variantSpec } from '@/challenge/lichess';
import { AxiosInstance } from 'axios';
import { Relation } from '@/challenge/operators';

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

export interface SpecFactory {
  teamSpec(teams: string, operator: Relation): Spec;
  encounterSpec(value: string, operator: Relation): Spec;
  ratingSpec(value: string, operator: Relation): Spec;
  ratedSpec(value: string, operator: Relation): Spec;
  variantSpec(value: string, operator: Relation): Spec;
}

export const specFactory = (http: AxiosInstance): SpecFactory => {
  return {
    teamSpec: teamSpecFactory(http),
    encounterSpec: encounterSpecFactory(http),
    ratingSpec: ratingSpec,
    ratedSpec: ratedSpec,
    variantSpec: variantSpec,
  };
};
