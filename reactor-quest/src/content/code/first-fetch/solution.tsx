import { useEffect, useState } from 'react';

export function CrewList({ load }: { load: () => Promise<string[]> }) {
  const [crew, setCrew] = useState<string[] | null>(null);

  useEffect(() => {
    load().then(setCrew);
  }, [load]);

  if (crew === null) return <p className="loading">Loading crew…</p>;
  return (
    <ul>
      {crew.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}
