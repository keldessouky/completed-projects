import { useEffect, useState } from 'react';

type State =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'done'; results: string[] }
  | { status: 'failed'; message: string };

export function StationSearch({ search }: { search: (query: string) => Promise<string[]> }) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });

  useEffect(() => {
    if (!query.trim()) {
      setState({ status: 'idle' });
      return;
    }
    let stale = false;
    setState({ status: 'searching' });
    search(query).then(
      (results) => {
        if (!stale) setState({ status: 'done', results });
      },
      (error: unknown) => {
        if (!stale) setState({ status: 'failed', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      stale = true;
    };
  }, [query, search]);

  return (
    <div>
      <label htmlFor="station-query">Search stations</label>
      <input id="station-query" value={query} onChange={(e) => setQuery(e.target.value)} />
      {state.status === 'searching' && <p className="status">Searching…</p>}
      {state.status === 'failed' && <p role="alert">Search failed: {state.message}</p>}
      {state.status === 'done' &&
        (state.results.length ? (
          <ul>
            {state.results.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <p className="status">No stations match</p>
        ))}
    </div>
  );
}
