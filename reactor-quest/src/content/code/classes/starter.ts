// A *class* is a blueprint for objects that bundle data with the functions
// (called *methods*) that work on it.
//
//   class Counter {
//     private count = 0;                 // private: only the class can touch it
//     constructor(public readonly name: string) {}   // runs on `new Counter("x")`
//     add(n: number) {                   // a method
//       this.count += n;                 // `this` is the object itself
//       return this.count;
//     }
//     get value() {                      // a getter: read it like a property
//       return this.count;
//     }
//   }
//   const c = new Counter("clicks");
//   c.add(2);    c.value   // 2

// A fuel tank with a fixed capacity, starting empty.
//   new FuelTank(200)
//   fill(amount)   adds fuel (never above capacity), returns the new level
//   drain(amount)  removes fuel, returns the new level — but THROWS an Error
//                  "Not enough fuel" if there isn't enough (and changes nothing)
//   level          a getter: the current amount
//   percent        a getter: level as a whole-number percentage of capacity (Math.round)
//
// The level must be private: nothing outside the class may change it directly.
export class FuelTank {
  level = 0;

  constructor(public readonly capacity: number) {}
}
