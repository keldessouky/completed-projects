// .reduce() boils a whole array down to ONE value. You give it a function and
// a starting value. The function receives the running result so far (often
// called acc, the "accumulator") and the next item, and returns the new result:
//
//   [4, 5, 6].reduce((acc, n) => acc + n, 0)       → 15
//      acc: 0 → 4 → 9 → 15
//
// The starting value can be anything — even an empty object {}.

// 1. Add up all the numbers with reduce.
export function sum(numbers: number[]): number {
  return 0;
}

// 2. The largest number. An empty list returns -Infinity.
//    (Math.max(a, b) gives the bigger of two numbers.)
export function largest(numbers: number[]): number {
  return 0;
}

// 3. Count how many crew members have each role:
//      [{ role: "pilot" }, { role: "medic" }, { role: "pilot" }]
//        → { pilot: 2, medic: 1 }
//    Record<string, number> is the type of an object whose keys are strings
//    and whose values are numbers. counts[role] reads or sets a key.
export function countByRole(crew: { role: string }[]): Record<string, number> {
  return {};
}
