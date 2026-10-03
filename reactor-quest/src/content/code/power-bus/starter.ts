// The power bus adds two voltages together.
// Strict mode is on, so TypeScript refuses to guess what `a` and `b` are —
// they are implicitly `any`, and that's an error. Annotate them.

export function addVoltage(a, b) {
  return a + b;
}
