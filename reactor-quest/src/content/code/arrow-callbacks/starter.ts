// Functions are values: you can store them in variables, pass them into other
// functions, and return them from functions.
//
//   const double = (n: number) => n * 2;              // a function in a variable
//   function apply(n: number, fn: (x: number) => number) {
//     return fn(n);                                   // call the function you were given
//   }
//   apply(5, double);                                 // 10
//
// (x: number) => number is the TYPE of "a function that takes a number and
// returns a number".

// 1. Rewrite triple as an arrow function stored in a const (keep the export).
export function triple(n: number): number {
  return n * 3;
}

// 2. Call fn on every value and return the results (a loop or .map — your choice).
export function applyAll(values: number[], fn: (n: number) => number): number[] {
  return values;
}

// 3. Return a NEW function that multiplies its input by factor:
//      const times5 = makeMultiplier(5);
//      times5(3)   → 15
export function makeMultiplier(factor: number): (n: number) => number {
  return (n) => n;
}
