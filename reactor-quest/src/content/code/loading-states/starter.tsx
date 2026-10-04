import { useEffect, useState } from 'react';

// Real data comes from a server, which takes time — and sometimes fails.
// Every screen that loads data has (at least) three states:
//
//   loading  → <p className="loading">Loading crew…</p>
//   loaded   → <ul> with an <li> per name
//   failed   → <p role="alert">Couldn't load crew: <error message></p>
//              plus a <button>Retry</button> that loads again
//
// `load` is the request. Call it when the component appears (and on Retry).

export function CrewLoader({ load }: { load: () => Promise<string[]> }) {
  const [crew, setCrew] = useState<string[]>([]);

  useEffect(() => {
    load().then(setCrew);
  }, [load]);

  return (
    <ul>
      {crew.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}
