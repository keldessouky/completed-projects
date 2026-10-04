export function totalWeight(weights: number[]): number {
  let total = 0;
  for (const w of weights) {
    total += w;
  }
  return total;
}

export function countHeavy(weights: number[], limit: number): number {
  let count = 0;
  for (const w of weights) {
    if (w > limit) {
      count++;
    }
  }
  return count;
}

export function longestName(names: string[]): string {
  let longest = "";
  for (const name of names) {
    if (name.length > longest.length) {
      longest = name;
    }
  }
  return longest;
}
