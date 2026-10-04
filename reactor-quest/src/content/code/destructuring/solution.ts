export type CrewMember = { name: string; role: string; rank?: string };

export function badge({ name, role, rank }: CrewMember): string {
  const title = rank ? `${rank} ${name}` : name;
  return `${title} — ${role}`;
}

export function swap(pair: [number, number]): [number, number] {
  const [a, b] = pair;
  return [b, a];
}

export function nextInQueue(queue: string[]): { next: string | undefined; waiting: string[] } {
  const [next, ...waiting] = queue;
  return { next, waiting };
}
