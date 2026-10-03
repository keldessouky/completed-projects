export const triple = (n: number): number => n * 3;

export function applyAll(values: number[], fn: (n: number) => number): number[] {
  return values.map(fn);
}

export function makeMultiplier(factor: number): (n: number) => number {
  return (n) => n * factor;
}
