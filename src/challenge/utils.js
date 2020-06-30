export const sum = (a, b) => a + b;
export const sumArray = arr => arr.reduce(sum, 0);

export const splitRandomElement = elements => {
  if (elements.length === 0) {
    return { current: null, other: [] };
  }
  const index = Math.floor(Math.random() * elements.length);

  return {
    current: elements[index],
    other: elements.filter((_v, i) => i !== index),
  };
};


