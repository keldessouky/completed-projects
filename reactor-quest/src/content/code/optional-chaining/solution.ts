export type Ship = {
  name: string;
  pilot?: { name: string; license?: { level: number } };
  cargo?: string[];
  volume?: number;
};

export function pilotName(ship: Ship): string {
  return ship.pilot?.name ?? "unassigned";
}

export function licenseLevel(ship: Ship): number {
  return ship.pilot?.license?.level ?? 0;
}

export function cargoCount(ship: Ship): number {
  return ship.cargo?.length ?? 0;
}

export function volume(ship: Ship): number {
  return ship.volume ?? 50;
}
