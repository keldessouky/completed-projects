export type Ship = { kind: "ship"; name: string; crew: number };
export type Cargo = { kind: "cargo"; label: string; mass: number };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export function isShip(x: unknown): x is Ship {
  return isRecord(x) && x.kind === "ship" && typeof x.name === "string" && typeof x.crew === "number";
}

export function isCargo(x: unknown): x is Cargo {
  return isRecord(x) && x.kind === "cargo" && typeof x.label === "string" && typeof x.mass === "number";
}

export function describeScan(x: unknown): string {
  if (isShip(x)) return `Ship ${x.name} (${x.crew} crew)`;
  if (isCargo(x)) return `Cargo ${x.label} (${x.mass} kg)`;
  return "Unknown object";
}
