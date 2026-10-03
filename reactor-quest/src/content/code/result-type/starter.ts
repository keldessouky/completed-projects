// Throwing errors is invisible in types: nothing in `parseAge(text: string): number`
// warns the caller it might blow up. A *Result* type makes failure part of the
// return type, so the compiler forces callers to handle it:
//
//   type Result<T> = { ok: true; value: T } | { ok: false; error: string };
//   const r = parseAge("42");
//   if (r.ok) { r.value }  else { r.error }     // narrowed by the `ok` tag

// 1. Define Result<T, E = string> — a discriminated union on `ok`.
//    (E = string is a *default* type parameter: Result<number> means Result<number, string>.)
export type Result<T, E = string> = any;

// 2. Helpers to build each side.
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

// 3. Division that can't divide by zero:  divide(6, 3) → ok(2),  divide(1, 0) → err("Division by zero")
export function divide(a: number, b: number): Result<number> {
  return ok(a / b);
}

// 4. Apply fn to the value of a successful result; pass failures through untouched.
//      mapResult(ok(2), (n) => n * 10) → ok(20)
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result;
}

// 5. Unwrap with a fallback:  unwrapOr(ok(5), 0) → 5,  unwrapOr(err("x"), 0) → 0
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  return fallback;
}
