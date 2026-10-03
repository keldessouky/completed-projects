export type ShipConfig = { name: string; crew: number; armed: boolean };

export type Flags<T> = { [K in keyof T]: boolean };

export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

export function changedFields<T extends object>(before: T, after: T): Flags<T> {
  const flags = {} as Flags<T>;
  for (const key of Object.keys(before) as (keyof T)[]) {
    flags[key] = before[key] !== after[key];
  }
  return flags;
}
