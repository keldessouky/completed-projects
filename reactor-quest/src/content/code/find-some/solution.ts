export type Door = { id: string; sealed: boolean };

export function findDoor(doors: Door[], id: string): Door | undefined {
  return doors.find((d) => d.id === id);
}

export function anyCritical(readings: number[]): boolean {
  return readings.some((r) => r > 900);
}

export function allSealed(doors: Door[]): boolean {
  return doors.every((d) => d.sealed);
}

export const ROLES = ["pilot", "engineer", "medic"];
export function isCertified(role: string): boolean {
  return ROLES.includes(role);
}
