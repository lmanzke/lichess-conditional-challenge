export const andSpec = (spec1, spec2) => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (!firstResult) {
      return false;
    }
    return spec2.isSatisfied(challenge);
  },
});

export const orSpec = (spec1, spec2) => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (firstResult) {
      return true;
    }
    return spec2.isSatisfied(challenge);
  },
});

export const notSpec = spec1 => ({
  isSatisfied: async challenge => {
    const result = await spec1.isSatisfied(challenge);

    return !result;
  },
});

export const applyCondition = (operator, spec1, spec2) => {
  switch (operator) {
    case 'AND':
      return andSpec(spec1, spec2);
    case 'OR':
    default:
      return orSpec(spec1, spec2);
  }
};

export const anySpec = {
  isSatisfied: async _challenge => true,
};
