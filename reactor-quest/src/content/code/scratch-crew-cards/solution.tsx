type CrewMember = { name: string; role: string; onDuty: boolean };

export function CrewCard({ name, role, onDuty }: CrewMember) {
  return (
    <article className="crew-card">
      <h3>{name}</h3>
      <p>{role}</p>
      {onDuty && <span className="badge">On duty</span>}
    </article>
  );
}

export function CrewList({ crew }: { crew: CrewMember[] }) {
  if (crew.length === 0) return <p className="empty">No crew aboard</p>;
  const onDuty = crew.filter((c) => c.onDuty).length;
  return (
    <div>
      <ul>
        {crew.map((c) => (
          <li key={c.name}>
            <CrewCard name={c.name} role={c.role} onDuty={c.onDuty} />
          </li>
        ))}
      </ul>
      <p className="count">{onDuty} on duty</p>
    </div>
  );
}
