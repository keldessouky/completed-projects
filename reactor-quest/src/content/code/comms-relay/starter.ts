// Two comms functions with the wrong types bolted on.
// Read the compiler's complaints, then fix the annotations.

export function hail(name: string, sector: number): number {
  return `Hailing ${name} in sector ${sector}`;
}

// Sectors below 10 are priority traffic.
export function isPriority(sector: string): string {
  // TODO
}
