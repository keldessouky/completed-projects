// Data is often incomplete. Reading a property of undefined crashes:
//   ship.pilot.name      💥 if ship has no pilot
//
// Optional chaining ?. stops early and gives undefined instead of crashing:
//   ship.pilot?.name     → undefined if there's no pilot
//
// Nullish coalescing ?? supplies a fallback ONLY for null or undefined:
//   ship.pilot?.name ?? "unassigned"
//
// Careful: || falls back for ANY falsy value — including 0 and "".
//   0 || 50   → 50   (oops, 0 was a real setting)
//   0 ?? 50   → 0    (correct)

export type Ship = {
  name: string;
  pilot?: { name: string; license?: { level: number } };
  cargo?: string[];
  volume?: number;
};

// 1. The pilot's name, or "unassigned".
export function pilotName(ship: Ship): string {
  return ship.pilot.name;
}

// 2. The pilot's license level, or 0 if there's no pilot or no license.
export function licenseLevel(ship: Ship): number {
  return ship.pilot.license.level;
}

// 3. How many cargo items, or 0 if there's no cargo list.
export function cargoCount(ship: Ship): number {
  return ship.cargo.length;
}

// 4. The ship's volume setting, defaulting to 50 — but 0 is a real setting (muted)!
export function volume(ship: Ship): number {
  return ship.volume || 50;
}
