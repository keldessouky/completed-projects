// The longer of two things that have a length — strings, arrays, …
// (On a tie, return the first.)
export function longest<T>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

// pluck(crew, 'name') → every crew member's name.
// `key` must be a real property of the items, and the result type should
// follow: plucking 'name' from { name: string } gives string[].
export function pluck<T>(items: T[], key: string): unknown[] {
  return items.map((item) => item[key]);
}
