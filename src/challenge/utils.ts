export const sum = (a: number, b: number) => a + b;
export const sumArray = (arr: number[]) => arr.reduce(sum, 0);

const separateIndex = <T>(elements: T[], index: number): { current: T | null; other: T[] } => {
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

export const splitRandomElement = <T>(elements: T[]): { current: T | null; other: T[] } => {
  const index = Math.floor(Math.random() * elements.length);

  return separateIndex(elements, index);
};

export const headTail = <T>(elements: T[]): { current: T | null; other: T[] } => separateIndex(elements, 0);
