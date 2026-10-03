export type CrewMember = { name: string; role: string; age: number; onDuty: boolean };

export function findPilot(crew: CrewMember[]): string {
  for (const member of crew) {
    if (member.role === "pilot") {
      return member.name;
    }
  }
  return "none";
}

export function onDutyNames(crew: CrewMember[]): string[] {
  const names: string[] = [];
  for (const member of crew) {
    if (member.onDuty) {
      names.push(member.name);
    }
  }
  return names;
}

export function averageAge(crew: CrewMember[]): number {
  if (crew.length === 0) {
    return 0;
  }
  let total = 0;
  for (const member of crew) {
    total += member.age;
  }
  return total / crew.length;
}
