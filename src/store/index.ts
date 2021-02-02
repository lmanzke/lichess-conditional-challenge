import { createStore } from 'vuex';

import * as getters from './getters';
import mutations from './mutations';
import { anySpec } from '@/challenge/spec';
import { Spec } from '@/challenge/types';

export interface State {
  specs: Spec;
}

export default createStore({
  state: (): State => ({
    specs: anySpec,
  }),
  getters,
  mutations,
});
