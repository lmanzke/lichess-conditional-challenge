import * as types from './mutation-types';

export default {
  [types.UPDATE_FOO](state, payload) {
    state.foo = payload;
  },

  [types.ADD_SPEC](state) {
    state.specs.push({ type: 'any' });
  },
};
