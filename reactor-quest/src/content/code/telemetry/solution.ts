export interface Reading {
  sensor: string;
  value: number | null;
}

export interface Summary {
  online: number;
  offline: number;
  average: number | null;
}

export function summarize(readings: Reading[]): Summary {
  const values: number[] = [];
  for (const r of readings) {
    if (r.value !== null) values.push(r.value);
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return {
    online: values.length,
    offline: readings.length - values.length,
    average: values.length ? sum / values.length : null,
  };
}

export function hottest(readings: Reading[]): Reading | undefined {
  let best: Reading | undefined;
  for (const r of readings) {
    if (r.value === null) continue;
    if (best === undefined || r.value > (best.value ?? -Infinity)) best = r;
  }
  return best;
}
