export const sum = (a: number, b: number): number => a + b;
export const sumArray = (arr: number[]): number => arr.reduce(sum, 0);

export interface SplitCollection<T> {
  current: T | null;
  other: T[];
}

export interface Splitter {
  <T>(elements: T[]): SplitCollection<T>;
}

const separateIndex = <T>(elements: T[], index: number): SplitCollection<T> => {
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

export const splitRandomElement: Splitter = <T>(elements: T[]): SplitCollection<T> => {
  const index = Math.floor(Math.random() * elements.length);

  return separateIndex(elements, index);
};

export const headTail: Splitter = <T>(elements: T[]): SplitCollection<T> => separateIndex(elements, 0);
