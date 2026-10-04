// A function remembers the variables that were around when it was created —
// even after the outer function has finished. This is called a *closure*:
//
//   function makeGreeter(greeting: string) {
//     return (name: string) => `${greeting}, ${name}`;   // remembers greeting
//   }
//   const hi = makeGreeter("Hi");
//   hi("Ada");    // "Hi, Ada"
//
// Each call to makeGreeter makes a fresh closure with its own greeting.

// 1. A counter with private state. Each counter counts independently.
//      const c = makeCounter();
//      c.increment();  // 1
//      c.increment();  // 2
//      c.current();    // 2
export function makeCounter() {
  return {
    increment: () => 1,
    current: () => 0,
  };
}

// 2. Ids with a prefix and a running number:
//      const next = makeIdGenerator("SHIP");
//      next() → "SHIP-1",  next() → "SHIP-2"
export function makeIdGenerator(prefix: string): () => string {
  return () => prefix;
}

// 3. Wrap fn so it only ever runs once. Later calls return the first result.
//      const init = once(() => expensiveSetup());
export function once(fn: () => number): () => number {
  return fn;
}
