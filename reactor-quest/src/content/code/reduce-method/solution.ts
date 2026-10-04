export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

export function largest(numbers: number[]): number {
  return numbers.reduce((acc, n) => Math.max(acc, n), -Infinity);
}

export function countByRole(crew: { role: string }[]): Record<string, number> {
  return crew.reduce((counts: Record<string, number>, member) => {
    counts[member.role] = (counts[member.role] || 0) + 1;
    return counts;
  }, {});
}
