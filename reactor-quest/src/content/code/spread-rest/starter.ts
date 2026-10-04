// The spread operator ... copies everything out of an array or object:
//
//   const more = [...list, "new"];           // a NEW array: list's items plus one
//   const updated = { ...ship, crew: 5 };     // a NEW object: ship's properties, crew replaced
//   Math.max(...[3, 9, 4]);                   // spreads the array into arguments: 9
//
// In a parameter list, ... collects any number of arguments into an array (rest):
//   function total(...nums: number[]) { … }   total(1, 2, 3)  → nums is [1, 2, 3]
//
// None of these functions may change what they were given — always return new values.

// 1. A new roster with the name added at the end.
export function addToRoster(roster: string[], name: string): string[] {
  roster.push(name);
  return roster;
}

// 2. A new ship object with the fuel changed.
export type Ship = { name: string; fuel: number };

export function withFuel(ship: Ship, fuel: number): Ship {
  ship.fuel = fuel;
  return ship;
}

// 3. Settings: start from the defaults, and let overrides replace any of them.
//    (volume?: means the property is optional — it may be left out.)
export function settings(
  defaults: { volume: number; theme: string; alerts: boolean },
  overrides: { volume?: number; theme?: string; alerts?: boolean },
) {
  return defaults;
}

// 4. The highest of any number of readings:   highest(3, 9, 4) → 9
//    (No readings at all → -Infinity, which is what Math.max() gives.)
export function highest(readings: number[]): number {
  return 0;
}
