// Destructuring unpacks objects and arrays into variables in one line:
//
//   const { name, crew } = ship;          // same as name = ship.name; crew = ship.crew
//   const [first, second] = list;         // same as first = list[0]; second = list[1]
//   const [head, ...rest] = list;         // rest is everything after the first
//   function hello({ name }: { name: string }) { … }   // in a parameter, too
//   const { crew = 1 } = ship;            // a default, if crew is undefined

export type CrewMember = { name: string; role: string; rank?: string };

// 1. "Ada — engineer", or with a rank: "Lt. Ada — engineer".
//    Destructure the parameter. Give rank a default of "" if you like.
export function badge(member: CrewMember): string {
  return member.name;
}

// 2. Swap the two values:   swap([1, 2]) → [2, 1]
export function swap(pair: [number, number]): [number, number] {
  return pair;
}

// 3. Split a queue into the next ship and everyone still waiting:
//      nextInQueue(["Kite", "Swift", "Vega"]) → { next: "Kite", waiting: ["Swift", "Vega"] }
export function nextInQueue(queue: string[]): { next: string | undefined; waiting: string[] } {
  return { next: undefined, waiting: queue };
}
