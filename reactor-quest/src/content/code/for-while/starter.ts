// Sometimes you need a loop that counts, not one that walks through a list.
//
// A classic for loop has three parts: start; keep going while; step
//   for (let i = 1; i <= 3; i++) {     // i++ means "add 1 to i"
//     console.log(i);                  // 1, 2, 3
//   }
//
// A while loop repeats as long as its condition is true:
//   let fuel = 10;
//   while (fuel > 0) {
//     fuel = fuel - 4;
//   }
//
// Careful: if the condition never becomes false, the loop never ends!

// 1. Return the numbers from `from` down to 1:   countdown(3) → [3, 2, 1]
//    (Start with an empty array [] and push each number.)
export function countdown(from: number): number[] {
  return [];
}

// 2. Return every even number from 2 up to and including limit:
//      evens(7) → [2, 4, 6]
export function evens(limit: number): number[] {
  return [];
}

// 3. A thruster burn uses `burn` units of fuel. How many burns until the fuel
//    runs out (reaches 0 or less)?   burnsUntilEmpty(10, 4) → 3
export function burnsUntilEmpty(fuel: number, burn: number): number {
  return 0;
}
