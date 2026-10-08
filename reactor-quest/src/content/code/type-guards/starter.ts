// Write real type guards: `x` could be anything at all. (Examples are in the Lesson tab.)

export type Ship = { kind: "ship"; name: string; crew: number };
export type Cargo = { kind: "cargo"; label: string; mass: number };

// 1. A guard for Ship. It must check the shape properly — `x` could be
//    anything at all: null, a number, an object with the wrong fields…
export function isShip(x: unknown): boolean {
  return true;
}

// 2. A guard for Cargo, the same way.
export function isCargo(x: unknown): boolean {
  return true;
}

// 3. Describe anything that comes off the scanner:
//      a Ship  → "Ship Kite (4 crew)"
//      Cargo   → "Cargo coolant (120 kg)"
//      other   → "Unknown object"
export function describeScan(x: unknown): string {
  return "Unknown object";
}
