export function addToRoster(roster: string[], name: string): string[] {
  return [...roster, name];
}

export type Ship = { name: string; fuel: number };

export function withFuel(ship: Ship, fuel: number): Ship {
  return { ...ship, fuel };
}

export function settings(
  defaults: { volume: number; theme: string; alerts: boolean },
  overrides: { volume?: number; theme?: string; alerts?: boolean },
) {
  return { ...defaults, ...overrides };
}

export function highest(...readings: number[]): number {
  return Math.max(...readings);
}
