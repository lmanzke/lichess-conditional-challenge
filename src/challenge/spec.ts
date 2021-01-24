import { encounterSpecFactory, ratedSpec, ratingSpec, Spec, teamSpecFactory, userIdSpec, variantSpec } from '@/challenge/lichess';
import { AxiosInstance } from 'axios';
import { Relation } from '@/challenge/operators';

export const andSpec = (spec1: Spec, spec2: Spec): Spec => ({
  execute: async challenge => {
    const firstSpecResult = await spec1.execute(challenge);
    if (!firstSpecResult.isSatisfied) {
      return firstSpecResult;
    }
    return spec2.execute(challenge);
  },
});

export const orSpec = (spec1: Spec, spec2: Spec): Spec => ({
  execute: async challenge => {
    const firstSpecResult = await spec1.execute(challenge);
    if (firstSpecResult.isSatisfied) {
      return firstSpecResult;
    }
    return spec2.execute(challenge);
  },
});

export const notSpec = (spec1: Spec): Spec => ({
  execute: async challenge => {
    const result = await spec1.execute(challenge);

    return { isSatisfied: !result.isSatisfied, silent: result.silent };
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
  execute: async _challenge => ({ isSatisfied: true, silent: false }),
};

export const noneSpec: Spec = {
  execute: async _challenge => ({ isSatisfied: false, silent: false }),
};

export interface SpecFactory {
  teamSpec(teams: string, operator: Relation, silent: boolean): Spec;
  encounterSpec(value: string, operator: Relation, silent: boolean): Spec;
  ratingSpec(value: string, operator: Relation, silent: boolean): Spec;
  ratedSpec(value: string, operator: Relation, silent: boolean): Spec;
  variantSpec(value: string, operator: Relation, silent: boolean): Spec;
  userIdSpec(value: string, operator: Relation, silent: boolean): Spec;
}

export const specFactory = (http: AxiosInstance): SpecFactory => {
  return {
    teamSpec: teamSpecFactory(http),
    encounterSpec: encounterSpecFactory(http),
    ratingSpec: ratingSpec,
    ratedSpec: ratedSpec,
    variantSpec: variantSpec,
    userIdSpec: userIdSpec,
  };
};
