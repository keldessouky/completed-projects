import { useEffect, useState } from 'react';

// Data from a server arrives *later*. `load()` returns a Promise: a value that
// isn't ready yet. `.then(fn)` runs fn with the crew list once it arrives.
//
// This component asks the server for the crew on EVERY render. Each answer
// updates state, which renders again, which asks again… forever. The personnel
// server is melting.
//
// Fix it:
//   1. Ask once, when the component appears: move the request into useEffect,
//      with [load] as its list of dependencies.
//   2. Until the answer arrives, show  <p className="loading">Loading crew…</p>
//      (Tip: start the state as null, meaning "not loaded yet".)
//   3. Then show the names: a <ul> with an <li> for each name.

export function CrewList({ load }: { load: () => Promise<string[]> }) {
  const [crew, setCrew] = useState<string[]>([]);

  load().then(setCrew);

  return (
    <ul>
      {crew.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}
