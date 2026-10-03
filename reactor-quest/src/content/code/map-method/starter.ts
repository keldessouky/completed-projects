// Arrays have built-in *methods* that loop for you. .map() builds a NEW array
// by transforming every item with a function you give it:
//
//   [1, 2, 3].map((n) => n * 10)        → [10, 20, 30]
//   ["a", "b"].map((s) => s + "!")      → ["a!", "b!"]
//
// (n) => n * 10 is a short way to write a function: "take n, give back n * 10".
// The original array is not changed.

// Use .map() for all three — no loops this time.

// 1. Every name in capital letters.   ["ada"] → ["ADA"]   (strings have .toUpperCase())
export function shout(names: string[]): string[] {
  return names;
}

// 2. Every price with 20% tax added (multiply by 1.2).
export function withTax(prices: number[]): number[] {
  return prices;
}

// 3. A label for each crew member:   { name: "Ada", role: "pilot" } → "Ada (pilot)"
export function labels(crew: { name: string; role: string }[]): string[] {
  return [];
}
