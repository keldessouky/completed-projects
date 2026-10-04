export class SchemaError extends Error {}

export interface Schema<T> {
  check(input: unknown, path: string): T;
  parse(input: unknown): T;
  safeParse(input: unknown): { success: true; data: T } | { success: false; error: string };
}

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

export function fail(path: string, expected: string): never {
  throw new SchemaError(`Expected ${expected} at ${path}`);
}

export type Infer<S> = S extends Schema<infer T> ? T : never;

export function string(): Schema<string> {
  return makeSchema((input, path) => (typeof input === "string" ? input : fail(path, "string")));
}
export function number(): Schema<number> {
  return makeSchema((input, path) => (typeof input === "number" && !Number.isNaN(input) ? input : fail(path, "number")));
}
export function boolean(): Schema<boolean> {
  return makeSchema((input, path) => (typeof input === "boolean" ? input : fail(path, "boolean")));
}

export function array<T>(item: Schema<T>): Schema<T[]> {
  return makeSchema((input, path) => {
    if (!Array.isArray(input)) return fail(path, "array");
    return input.map((element, i) => item.check(element, `${path}[${i}]`));
  });
}

export function object<S extends Record<string, Schema<unknown>>>(shape: S): Schema<{ [K in keyof S]: Infer<S[K]> }> {
  return makeSchema((input, path) => {
    if (typeof input !== "object" || input === null || Array.isArray(input)) return fail(path, "object");
    const record = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(shape)) {
      const value = shape[key].check(record[key], `${path}.${key}`);
      if (value !== undefined) out[key] = value;
    }
    return out as { [K in keyof S]: Infer<S[K]> };
  });
}

export function optional<T>(schema: Schema<T>): Schema<T | undefined> {
  return makeSchema((input, path) => (input === undefined ? undefined : schema.check(input, path)));
}
