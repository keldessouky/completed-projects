export type ElementOf<T> = T extends (infer U)[] ? U : never;

export type Unwrap<T> = T extends Promise<infer U> ? U : T;

export type NonNullish<T> = T extends null | undefined ? never : T;

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function compact<T>(values: T[]): NonNullish<T>[] {
  return values.filter((v): v is NonNullish<T> => v !== null && v !== undefined);
}
