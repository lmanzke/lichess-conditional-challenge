import { createStore } from 'vuex';

import * as getters from './getters';
import mutations from './mutations';
import * as actions from './actions';

export default createStore({
  state: () => ({
    specs: [],
  }),
  getters,
  mutations,
  actions,
});
