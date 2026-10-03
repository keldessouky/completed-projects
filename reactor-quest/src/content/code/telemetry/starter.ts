// BOSS — Reactor Telemetry.
// Every sensor reports a value, or null when it's offline.
export interface Reading {
  sensor: string;
  value: number | null;
}

export interface Summary {
  // TODO: online (count), offline (count),
  //       average (of the online values — or null if none are online)
}

export function summarize(readings: Reading[]): Summary {
  // TODO
}

// The online reading with the highest value, or undefined if none are online.
export function hottest(readings: Reading[]) {
  // TODO
}
