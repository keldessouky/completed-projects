// An *object* groups related values under names, called *properties*:
//
//   const ship = { name: "Kite", crew: 4, docked: true };
//   ship.name        → "Kite"
//   ship.crew = 5;   changes a property
//
// Its type lists each property and its type:
//   { name: string; crew: number; docked: boolean }

// 1. Describe a ship:   "Kite (4 crew, docked)"   or   "Kite (4 crew, in flight)"
export function describeShip(ship: { name: string; crew: number; docked: boolean }): string {
  return ship.name;
}

// 2. Make a brand-new ship object with the given name, 0 crew, docked.
//      newShip("Swift") → { name: "Swift", crew: 0, docked: true }
export function newShip(name: string): { name: string; crew: number; docked: boolean } {
  return { name: name, crew: 1, docked: false };
}

// 3. Add `amount` to the ship's fuel, but never above 100. Change the ship's
//    fuel property, and return the new fuel level.
//      refuel({ fuel: 90 }, 25) → 100    (and the ship now has fuel: 100)
export function refuel(ship: { fuel: number }, amount: number): number {
  return ship.fuel + amount;
}
