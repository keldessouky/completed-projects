export function powerLevel(generators: number): number {
  return 50 + generators * 125;
}

export function systemReport(name: string, power: number): string {
  if (power === 0) {
    return `${name}: OFFLINE`;
  } else if (power < 100) {
    return `${name}: LOW (${power})`;
  } else {
    return `${name}: ONLINE (${power})`;
  }
}

export function readyToBoot(power: number, crew: number, doorsSealed: boolean): boolean {
  return power >= 250 && crew >= 1 && crew <= 6 && doorsSealed;
}

console.log(systemReport("Reactor", powerLevel(3)));
