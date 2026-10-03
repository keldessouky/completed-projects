export interface Crew {
  id: number;
  name: string;
  role: 'pilot' | 'engineer' | 'medic';
  onDuty: boolean;
}

export function CrewCard({ member }: { member: Crew }) {
  return (
    <li className={`card ${member.role}`}>
      <b>{member.name}</b> <span>{member.role}</span>
      {!member.onDuty && <em>off duty</em>}
    </li>
  );
}

export function Roster({ crew, title = 'Crew' }: { crew: Crew[]; title?: string }) {
  const onDuty = crew.filter((m) => m.onDuty).length;
  return (
    <section>
      <h2>
        {title} ({onDuty}/{crew.length} on duty)
      </h2>
      {crew.length === 0 ? (
        <p>No crew aboard</p>
      ) : (
        <ul>
          {crew.map((m) => (
            <CrewCard key={m.id} member={m} />
          ))}
        </ul>
      )}
    </section>
  );
}
