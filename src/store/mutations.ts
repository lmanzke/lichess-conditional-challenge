import * as types from './mutation-types';
import { State } from '@/store/index';
import { anySpec } from '@/challenge/spec';

export default {
  [types.ADD_SPEC](state: State): void {
    state.specs.push(anySpec);
  },
};
