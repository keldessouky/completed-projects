// BOSS — Boot Diagnostics.
// Everything from this floor, in one boot sequence.

// 1. Each working generator makes 125 units, on top of a base of 50.
//      powerLevel(2)  →  300
export function powerLevel(generators: number): number {
  return 0;
}

// 2. A one-line report for a system:
//      power 0          →  "Comms: OFFLINE"
//      power below 100  →  "Comms: LOW (40)"
//      otherwise        →  "Comms: ONLINE (300)"
export function systemReport(name: string, power: number): string {
  return name;
}

// 3. Ready to boot when ALL of these are true:
//      power is at least 250,
//      between 1 and 6 crew are aboard (including 1 and 6),
//      and the doors are sealed.
export function readyToBoot(power: number, crew: number, doorsSealed: boolean): boolean {
  return false;
}

// 4. Finally, print the report for the "Reactor", using powerLevel(3) as its power.
//    It should print:   Reactor: ONLINE (425)
