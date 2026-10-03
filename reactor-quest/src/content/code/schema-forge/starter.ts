// BOSS — Schema Forge.
// Build a tiny runtime validator whose types are INFERRED from the schemas,
// the way professional libraries (like zod) work:
//
//   const Ship = object({ name: string(), crew: number(), tags: array(string()) });
//   type Ship = Infer<typeof Ship>;          // { name: string; crew: number; tags: string[] }
//   const ship = Ship.parse(JSON.parse(text)); // throws if the data is wrong; typed if it's right

/** Thrown when data doesn't match; the message says what and where. */
export class SchemaError extends Error {}

export interface Schema<T> {
  /** Validate `input` (found at `path`) and return it typed — or throw a SchemaError. */
  check(input: unknown, path: string): T;
  /** Validate from the top: throws on bad data. */
  parse(input: unknown): T;
  /** Never throws. */
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: string };
}

/** Builds parse and safeParse around a check function. (Done for you.) */
export function makeSchema<T>(check: (input: unknown, path: string) => T): Schema<T> {
  return {
    check,
    parse: (input) => check(input, "value"),
    safeParse: (input) => {
      try {
        return { success: true, data: check(input, "value") };
      } catch (e) {
        if (e instanceof SchemaError) return { success: false, error: e.message };
        throw e;
      }
    },
  };
}

/** The error to throw:  fail("value.crew", "number") → "Expected number at value.crew" */
export function fail(path: string, expected: string): never {
  throw new SchemaError(`Expected ${expected} at ${path}`);
}

// 1. Infer<S>: the type a schema produces.  Infer<Schema<number>> → number
export type Infer<S> = any;

// 2. Schemas for the basic types. number() must reject NaN.
export function string(): Schema<string> {
  return makeSchema((input) => input as string);
}
export function number(): Schema<number> {
  return makeSchema((input) => input as number);
}
export function boolean(): Schema<boolean> {
  return makeSchema((input) => input as boolean);
}

// 3. array(item): an array whose every element matches `item`.
//    Paths for elements look like  value.tags[2]
export function array<T>(item: Schema<T>): Schema<T[]> {
  return makeSchema((input) => input as T[]);
}

// 4. object(shape): an object with each key matching its schema.
//    Paths for fields look like  value.crew   (nested: value.pilot.age)
//    The result contains only the keys in the shape (extra keys are dropped).
//    Its type is inferred:  object({ a: number() })  →  Schema<{ a: number }>
export function object(shape: Record<string, Schema<any>>): Schema<any> {
  return makeSchema((input) => input);
}

// 5. optional(s): the value may be undefined (or the key missing); otherwise it must match s.
export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return schema;
}
