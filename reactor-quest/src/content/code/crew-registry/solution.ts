export interface CrewMember {
  readonly id: number;
  name: string;
  role: string;
  callsign?: string;
}

export function badge(member: CrewMember): string {
  const call = member.callsign ? ` "${member.callsign}"` : '';
  return `${member.name}${call} — ${member.role}`;
}
