export function hail(name: string, sector: number): string {
  return `Hailing ${name} in sector ${sector}`;
}

// Sectors below 10 are priority traffic.
export function isPriority(sector: number): boolean {
  return sector < 10;
}
