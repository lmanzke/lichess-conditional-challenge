import { anySpec } from '@/challenge/spec';
import { State } from '@/store/index';
import { Spec } from '@/challenge/types';

export const specs = (_state: State): Spec => {
  return anySpec;
};
