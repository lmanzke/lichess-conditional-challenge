import { createStore } from 'vuex';

import * as getters from './getters';
import mutations from './mutations';
import { Spec } from '@/challenge/lichess';

export interface State {
  specs: Spec[];
}

export default createStore({
  state: (): State => ({
    specs: [],
  }),
  getters,
  mutations,
});
