import * as SRTE from 'fp-ts/StateReaderTaskEither';
import { Semigroup } from 'fp-ts/Semigroup';
import { pipe } from 'fp-ts/function';
import { Monoid } from 'fp-ts/Monoid';
import { DeclineReason, Spec, SpecResult } from '@/challenge/types';
import { ofSpecReader } from '@/challenge/utils';

const andSpec = (spec1: Spec, spec2: Spec): Spec => challenge =>
  pipe(
    challenge,
    spec1,
    SRTE.chain(result => {
      if (!result.isSatisfied) {
        return SRTE.of(result);
      }

      return spec2(challenge);
    })
  );

const orSpec = (spec1: Spec, spec2: Spec): Spec => challenge =>
  pipe(
    challenge,
    spec1,
    SRTE.chain(result => {
      if (result.isSatisfied) {
        return SRTE.of(result);
      }

      return spec2(challenge);
    })
  );

export const anySpec: Spec = _challenge => ofSpecReader<SpecResult>({ isSatisfied: true });
export const noneSpec: Spec = _challenge => ofSpecReader<SpecResult>({ isSatisfied: false, silent: false, reason: DeclineReason.RULE_FAILED });

const andSpecSemigroup: Semigroup<Spec> = {
  concat: andSpec,
};

const orSpecSemigroup: Semigroup<Spec> = {
  concat: orSpec,
};

const andSpecMonoid: Monoid<Spec> = {
  concat: andSpecSemigroup.concat,
  empty: anySpec,
};

const orSpecMonoid: Monoid<Spec> = {
  concat: orSpecSemigroup.concat,
  empty: noneSpec,
};

export const getSpecMonoid = (operator: string): Monoid<Spec> => {
  switch (operator) {
    case 'AND':
      return andSpecMonoid;
    case 'OR':
    default:
      return orSpecMonoid;
  }
};
