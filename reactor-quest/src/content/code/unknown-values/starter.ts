// Signals arrive from outside the station, so nobody knows their type in
// advance. The last engineer typed them as `any`, which switches type checking
// OFF: the compiler happily lets you call .toUpperCase() on a number, and the
// scrubber crashes at runtime.
//
// `unknown` is the safe opposite: anything can go IN, but you have to check
// what it is before you use it. Each check *narrows* the type:
//
//   if (typeof x === "string") { x.toUpperCase(); }   // x is a string in here
//   if (Array.isArray(x)) { x.length; }               // x is an array in here
//
// 1. Change both `any`s to `unknown`. Press Run and read the new errors:
//    each one is a crash waiting to happen.
// 2. Fix them by narrowing. describeSignal(x) returns:
//      a string      → "text: HELLO"         (upper-cased)
//      a number      → "number: 42.5"        (one decimal place: x.toFixed(1))
//      a boolean     → "flag: on" or "flag: off"
//      an array      → "list of 3"           (its length)
//      null          → "empty"
//      anything else → "unknown"
// 3. signalLength(x) returns the length of a string or an array, otherwise 0.

export function describeSignal(x: any): string {
  return "text: " + x.toUpperCase();
}

export function signalLength(x: any): number {
  return x.length;
}
