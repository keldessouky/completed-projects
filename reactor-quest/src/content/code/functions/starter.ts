// A *function* is a reusable recipe: give it inputs, it does some work,
// and `return` hands back the result.
//
//   function double(n: number): number {
//     return n * 2;
//   }
//   double(4);   // 8
//
// n is the function's *parameter* — the name for whatever input it's given.
// The ": number" labels are *types*: they say what kind of value goes in and
// what comes out. `export` lets the rest of the station (and the tests) use it.

// 1. Make square return n multiplied by itself.
export function square(n: number): number {
  return 0;
}

// 2. Write a function called greet. It takes one parameter, a name (a string),
//    and returns "Welcome aboard, " + the name + "!".
//      greet("Ada")   →   "Welcome aboard, Ada!"
