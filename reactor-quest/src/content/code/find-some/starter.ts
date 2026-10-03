// More questions you can ask an array:
//   .find(fn)      the FIRST item where fn says yes — or undefined if none
//   .some(fn)      true if AT LEAST ONE item passes
//   .every(fn)     true if ALL items pass
//   .includes(x)   true if x is in the array
//
//   [3, 9, 14].find((n) => n > 5)       → 9
//   [3, 9, 14].some((n) => n > 10)      → true
//   [3, 9, 14].every((n) => n > 10)     → false
//   ["a", "b"].includes("b")            → true

export type Door = { id: string; sealed: boolean };

// 1. The door with this id — or undefined if there's no such door.
export function findDoor(doors: Door[], id: string): Door | undefined {
  return undefined;
}

// 2. Is ANY reading above 900?
export function anyCritical(readings: number[]): boolean {
  return false;
}

// 3. Is EVERY door sealed?
export function allSealed(doors: Door[]): boolean {
  return false;
}

// 4. Is this role one of the station's certified roles?
export const ROLES = ["pilot", "engineer", "medic"];
export function isCertified(role: string): boolean {
  return false;
}
