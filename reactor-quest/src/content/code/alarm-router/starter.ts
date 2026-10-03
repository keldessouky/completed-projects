// Every alarm has a `kind` tag, and each kind carries different data.
export type Alarm =
  | { kind: 'fire'; deck: number }
  | { kind: 'breach'; deck: number; pressure: number }
  | { kind: 'intruder'; name: string };

//  fire      → "Fire on deck 3"
//  breach    → "Breach on deck 2 at 40 kPa"
//  intruder  → "Intruder: Vex"
export function route(alarm: Alarm): string {
  if (alarm.kind === 'fire') {
    return `Fire on deck ${alarm.deck}`;
  }
  return `Breach on deck ${alarm.deck} at ${alarm.pressure} kPa`;
}
