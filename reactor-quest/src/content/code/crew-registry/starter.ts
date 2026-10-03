// Describe the shape of a crew member with an interface:
//   id        a number that must never change after creation
//   name      a string
//   role      a string
//   callsign  a string, but not everyone has one
export interface CrewMember {
  // TODO
}

// "Ada Okafor — engineer", or with a callsign: 'Ada Okafor "Sparks" — engineer'
export function badge(member: CrewMember): string {
  // TODO
}
