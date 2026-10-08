export interface Refuel {
  ship: string;
  litres: number;
  note?: string;
}

export function totalFor(log: Refuel[], ship: string): number {
  let total = 0;
  for (const entry of log) {
    if (entry.ship === ship) total += entry.litres;
  }
  return total;
}

export function describe(entry: Refuel | null): string {
  if (entry === null) return "No refuel";
  const base = `${entry.ship}: ${entry.litres} L`;
  return entry.note ? `${base} (${entry.note})` : base;
}

export function biggest(log: Refuel[]): Refuel | null {
  let best: Refuel | null = null;
  for (const entry of log) {
    if (best === null || entry.litres > best.litres) best = entry;
  }
  return best;
}
