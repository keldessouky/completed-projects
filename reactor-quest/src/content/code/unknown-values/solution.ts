export function describeSignal(x: unknown): string {
  if (typeof x === "string") return `text: ${x.toUpperCase()}`;
  if (typeof x === "number") return `number: ${x.toFixed(1)}`;
  if (typeof x === "boolean") return x ? "flag: on" : "flag: off";
  if (Array.isArray(x)) return `list of ${x.length}`;
  if (x === null) return "empty";
  return "unknown";
}

export function signalLength(x: unknown): number {
  if (typeof x === "string" || Array.isArray(x)) return x.length;
  return 0;
}
