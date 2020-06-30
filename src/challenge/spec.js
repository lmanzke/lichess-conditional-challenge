export const andSpec = (spec1, spec2) => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (!firstResult) {
      return false;
    }
    const secondResult = await spec2.isSatisfied(challenge);

    return firstResult && secondResult;
  },
});

export const orSpec = (spec1, spec2) => ({
  isSatisfied: async challenge => {
    const firstResult = await spec1.isSatisfied(challenge);
    if (firstResult) {
      return true;
    }
    const secondResult = await spec2.isSatisfied(challenge);
    console.log(secondResult);

    return firstResult || secondResult;
  },
});

export const notSpec = spec1 => ({
  isSatisfied: async challenge => {
    const result = await spec1.isSatisfied(challenge);

    return !result;
  },
});

export const anySpec = {
  isSatisfied: async _challenge => true,
};
