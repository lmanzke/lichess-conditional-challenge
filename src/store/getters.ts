import { anySpec } from '../challenge/spec';

export const foo = state => state.foo;

export const specs = state => {
  if (state.specs.length === 0) {
    return anySpec;
  }
};
