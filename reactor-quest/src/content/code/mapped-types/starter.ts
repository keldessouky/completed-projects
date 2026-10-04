// A *mapped type* builds a new object type by looping over the keys of another:
//
//   type Optional<T> = { [K in keyof T]?: T[K] };     // that's how Partial works
//   type Strings<T>  = { [K in keyof T]: string };    // every value becomes a string
//
// Modifiers can be added (+?, +readonly) or removed (-?, -readonly).

export type ShipConfig = { name: string; crew: number; armed: boolean };

// 1. Flags<T>: the same keys as T, but every value is a boolean.
//      Flags<ShipConfig> = { name: boolean; crew: boolean; armed: boolean }
export type Flags<T> = Record<string, boolean>;

// 2. Mutable<T>: removes readonly from every property.
export type Mutable<T> = T;

// 3. Which fields differ between two versions of the same object?
//      changedFields({ name: "Kite", crew: 4, armed: false },
//                    { name: "Kite", crew: 5, armed: false })
//        → { name: false, crew: true, armed: false }
//    Object.keys(x) gives the keys as string[] — you'll need a cast to keyof T.
export function changedFields<T extends object>(before: T, after: T): Flags<T> {
  return {};
}
