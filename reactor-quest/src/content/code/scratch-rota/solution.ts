export type Shift = { name: string; hours: number };

export function totalHours(shifts: Shift[]): number {
  return shifts.reduce((sum, s) => sum + s.hours, 0);
}

export function overworked(shifts: Shift[], limit: number): string[] {
  return shifts.filter((s) => s.hours > limit).map((s) => s.name);
}

export function busiest(shifts: Shift[]): string {
  let best: Shift | undefined;
  for (const s of shifts) {
    if (!best || s.hours > best.hours) best = s;
  }
  return best ? best.name : "";
}
