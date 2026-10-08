export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export type Reading = { sensor: string; value: number };

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

export function parseReading(input: unknown): Result<Reading> {
  if (!isRecord(input)) return { ok: false, error: "Not an object" };
  if (typeof input.sensor !== "string") return { ok: false, error: "Missing sensor" };
  if (typeof input.value !== "number" || Number.isNaN(input.value)) return { ok: false, error: "Value must be a number" };
  return { ok: true, value: { sensor: input.sensor, value: input.value } };
}

export function parseAll(inputs: unknown[]): { readings: Reading[]; errors: string[] } {
  const readings: Reading[] = [];
  const errors: string[] = [];
  for (const input of inputs) {
    const r = parseReading(input);
    if (r.ok) readings.push(r.value);
    else errors.push(r.error);
  }
  return { readings, errors };
}
