export function shout(names: string[]): string[] {
  return names.map((name) => name.toUpperCase());
}

export function withTax(prices: number[]): number[] {
  return prices.map((price) => price * 1.2);
}

export function labels(crew: { name: string; role: string }[]): string[] {
  return crew.map((member) => `${member.name} (${member.role})`);
}
