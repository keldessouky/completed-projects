export function makeCounter() {
  let count = 0;
  return {
    increment: () => {
      count++;
      return count;
    },
    current: () => count,
  };
}

export function makeIdGenerator(prefix: string): () => string {
  let n = 0;
  return () => {
    n++;
    return `${prefix}-${n}`;
  };
}

export function once(fn: () => number): () => number {
  let called = false;
  let result = 0;
  return () => {
    if (!called) {
      called = true;
      result = fn();
    }
    return result;
  };
}
