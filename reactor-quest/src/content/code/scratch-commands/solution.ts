export type Command =
  | { kind: "move"; x: number; y: number }
  | { kind: "scan" }
  | { kind: "say"; text: string };

export function describe(command: Command): string {
  switch (command.kind) {
    case "move":
      return `Move to ${command.x},${command.y}`;
    case "scan":
      return "Scan";
    case "say":
      return `Say "${command.text}"`;
  }
}

export function countByKind(commands: Command[]): Record<Command["kind"], number> {
  const counts: Record<Command["kind"], number> = { move: 0, scan: 0, say: 0 };
  for (const c of commands) counts[c.kind]++;
  return counts;
}

export function lastOf<T>(items: T[]): T | undefined {
  return items[items.length - 1];
}
