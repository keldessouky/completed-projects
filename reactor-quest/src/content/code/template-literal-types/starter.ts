// Template literal types build string types the way template strings build strings:
//
//   type Deck = "A" | "B";
//   type Level = 1 | 2;
//   type Code = `${Deck}${Level}`;      // "A1" | "A2" | "B1" | "B2"
//
// Built-in helpers transform them: Uppercase<"a"> → "A", Capitalize<"dock"> → "Dock".
// In a mapped type, `as` renames keys:
//   type Getters<T> = { [K in keyof T & string as `get${Capitalize<K>}`]: () => T[K] };

export type Deck = "A" | "B" | "C";
export type Bay = 1 | 2 | 3 | 4;

// 1. Every valid bay code: "A1" … "C4".
export type BayCode = string;

// 2. A runtime check that a string is a BayCode, as a type guard.
export function isBayCode(s: string): boolean {
  return true;
}

// 3. The event handler prop name for an event: "dock" → "onDock".
//    The return type must be precise: handlerName("dock") has type "onDock".
export function handlerName(event: string): string {
  return event;
}

// 4. Handlers<E>: an object with one handler per event name.
//      Handlers<"dock" | "undock"> = { onDock: () => void; onUndock: () => void }
export type Handlers<E extends string> = Record<string, () => void>;
