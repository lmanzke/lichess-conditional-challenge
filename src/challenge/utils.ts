export const sum = (a, b) => a + b;
export const sumArray = arr => arr.reduce(sum, 0);

const separateIndex = (elements, index) => {
  if (elements.length === 0) {
    return { current: null, other: [] };
  }

  if (index > elements.length - 1) {
    return { current: null, other: elements };
  }

  return {
    current: elements[index],
    other: elements.filter((_v, i) => i !== index),
  };
};

export const splitRandomElement = elements => {
  const index = Math.floor(Math.random() * elements.length);

  return separateIndex(elements, index);
};

export const headTail = elements => separateIndex(elements, 0);
