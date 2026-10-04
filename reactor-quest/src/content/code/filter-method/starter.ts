// .filter() builds a NEW array with only the items your function says yes to:
//
//   [5, 12, 8, 20].filter((n) => n > 10)        → [12, 20]
//
// The function must return true (keep it) or false (drop it).
// Methods can be *chained* — filter first, then map what's left:
//   items.filter((i) => i.qty > 0).map((i) => i.name)

export type Sensor = { id: string; online: boolean; reading: number };

// 1. Only the sensors that are online.
export function onlineSensors(sensors: Sensor[]): Sensor[] {
  return sensors;
}

// 2. Only the prices at or below the budget.
export function affordable(prices: number[], budget: number): number[] {
  return prices;
}

// 3. The ids of online sensors whose reading is above 900, chained in one expression.
export function overheatingIds(sensors: Sensor[]): string[] {
  return [];
}
