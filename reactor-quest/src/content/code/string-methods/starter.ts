// Strings come with lots of built-in methods:
//   "  Hi  ".trim()               → "Hi"           (removes spaces at both ends)
//   "Deck 7".toLowerCase()        → "deck 7"
//   "a,b,c".split(",")            → ["a", "b", "c"]
//   ["a", "b"].join("-")          → "a-b"
//   "7".padStart(3, "0")          → "007"
//   "Ada"[0]                      → "A"
//   Number("42")                  → 42             (NaN if it isn't a number)
//   "Deck 7".replaceAll(" ", "_") → "Deck_7"

// 1. A URL-friendly name:  "  Deck 7 Galley " → "deck-7-galley"
//    (trim, lower-case, and spaces become dashes)
export function slugify(title: string): string {
  return title;
}

// 2. Initials:  "Ada Okafor" → "AO",  "Bo" → "B",  "nova kale ray" → "NKR"
export function initials(fullName: string): string {
  return "";
}

// 3. A three-digit bay code:  7 → "BAY-007",  42 → "BAY-042",  120 → "BAY-120"
export function bayCode(n: number): string {
  return `BAY-${n}`;
}

// 4. Coordinates from text:  "12, 40" → [12, 40]   (spaces around numbers allowed)
export function parseCoordinates(text: string): [number, number] {
  return [0, 0];
}
