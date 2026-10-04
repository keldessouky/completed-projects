export function countdown(from: number): number[] {
  const result: number[] = [];
  for (let i = from; i >= 1; i--) {
    result.push(i);
  }
  return result;
}

export function evens(limit: number): number[] {
  const result: number[] = [];
  for (let n = 2; n <= limit; n += 2) {
    result.push(n);
  }
  return result;
}

export function burnsUntilEmpty(fuel: number, burn: number): number {
  let burns = 0;
  while (fuel > 0) {
    fuel -= burn;
    burns++;
  }
  return burns;
}
