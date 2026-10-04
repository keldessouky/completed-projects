// A *conditional type* chooses a type based on another type:
//   type IsText<T> = T extends string ? "yes" : "no";
//   IsText<"hi">   → "yes"      IsText<42>  → "no"
//
// `infer` captures a part of the type being matched:
//   type ReturnOf<F> = F extends (...args: any[]) => infer R ? R : never;
//   ReturnOf<() => number>   → number
//
// Conditional types *distribute* over unions:  IsText<string | number> → "yes" | "no"

// 1. ElementOf<T>: the item type of an array type; never for anything else.
//      ElementOf<string[]> → string      ElementOf<number> → never
export type ElementOf<T> = unknown;

// 2. Unwrap<T>: the value inside a Promise; any other type stays as it is.
//      Unwrap<Promise<number>> → number      Unwrap<string> → string
export type Unwrap<T> = T;

// 3. NonNullish<T>: removes null and undefined from a union.
//      NonNullish<string | null | undefined> → string
export type NonNullish<T> = T;

// 4. A value, or a list of values, as a list:
//      toArray(5) → [5]      toArray([1, 2]) → [1, 2]
//    The return type should be ElementOf-style precise: toArray(5) is number[].
export function toArray<T>(value: T | T[]): T[] {
  return [];
}

// 5. Drop null and undefined from a list — and the type should follow:
//      compact([1, null, 2, undefined]) → [1, 2], typed number[]
export function compact<T>(values: T[]): T[] {
  return values;
}
