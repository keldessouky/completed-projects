// BOSS — the crew roster screen.
export interface Crew {
  id: number;
  name: string;
  role: 'pilot' | 'engineer' | 'medic';
  onDuty: boolean;
}

// One crew member:
//   <li className="card {role}">        e.g. className="card medic"
//     <b>{name}</b> <span>{role}</span>
//     …and <em>off duty</em> only when they are not on duty
//   </li>
export function CrewCard({ member }: { member: Crew }) {
  // TODO
}

// The roster:
//   <section>
//     <h2>{title} ({onDutyCount}/{total} on duty)</h2>    title defaults to "Crew"
//     a <ul> of CrewCards — or, with nobody aboard, <p>No crew aboard</p> instead
//   </section>
export function Roster({ crew, title }: { crew: Crew[]; title?: string }) {
  // TODO
}
