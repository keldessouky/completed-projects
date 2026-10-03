// Real data is usually a list of objects. A *type alias* gives a shape a name,
// so you don't have to repeat it:
export type CrewMember = { name: string; role: string; age: number; onDuty: boolean };

// 1. Return the name of the first crew member whose role is "pilot",
//    or "none" if there isn't one.
export function findPilot(crew: CrewMember[]): string {
  return "none";
}

// 2. Return the names of everyone on duty, in order.
export function onDutyNames(crew: CrewMember[]): string[] {
  return [];
}

// 3. Return the average age (total age ÷ number of people).
//    An empty crew has an average age of 0.
export function averageAge(crew: CrewMember[]): number {
  return 0;
}
