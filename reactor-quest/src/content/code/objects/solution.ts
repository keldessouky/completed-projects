export function describeShip(ship: { name: string; crew: number; docked: boolean }): string {
  const status = ship.docked ? "docked" : "in flight";
  return `${ship.name} (${ship.crew} crew, ${status})`;
}

export function newShip(name: string): { name: string; crew: number; docked: boolean } {
  return { name: name, crew: 0, docked: true };
}

export function refuel(ship: { fuel: number }, amount: number): number {
  ship.fuel = ship.fuel + amount;
  if (ship.fuel > 100) {
    ship.fuel = 100;
  }
  return ship.fuel;
}
