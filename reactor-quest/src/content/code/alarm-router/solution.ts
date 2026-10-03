export type Alarm =
  | { kind: 'fire'; deck: number }
  | { kind: 'breach'; deck: number; pressure: number }
  | { kind: 'intruder'; name: string };

export function route(alarm: Alarm): string {
  switch (alarm.kind) {
    case 'fire':
      return `Fire on deck ${alarm.deck}`;
    case 'breach':
      return `Breach on deck ${alarm.deck} at ${alarm.pressure} kPa`;
    case 'intruder':
      return `Intruder: ${alarm.name}`;
    default: {
      const unhandled: never = alarm;
      return unhandled;
    }
  }
}
