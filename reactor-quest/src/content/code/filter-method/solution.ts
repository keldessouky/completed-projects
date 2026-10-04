export type Sensor = { id: string; online: boolean; reading: number };

export function onlineSensors(sensors: Sensor[]): Sensor[] {
  return sensors.filter((s) => s.online);
}

export function affordable(prices: number[], budget: number): number[] {
  return prices.filter((p) => p <= budget);
}

export function overheatingIds(sensors: Sensor[]): string[] {
  return sensors.filter((s) => s.online && s.reading > 900).map((s) => s.id);
}
