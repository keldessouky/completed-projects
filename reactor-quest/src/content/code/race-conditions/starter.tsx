import { useEffect, useState } from 'react';

// Search as you type. Each keystroke starts a new request — and requests can
// come back in ANY order. If "ka" is slow and "kite" is fast, the "ka" results
// can arrive LAST and overwrite the correct "kite" results.
//
//   <input aria-label="Search ships" />
//   <ul> with an <li> per result
//
// An empty query shows no results and makes no request.
// Make sure a stale response can never overwrite a newer one.

export function ShipSearch({ search }: { search: (query: string) => Promise<string[]> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    search(query).then(setResults);
  }, [query, search]);

  return (
    <div>
      <input aria-label="Search ships" value={query} onChange={(e) => setQuery(e.target.value)} />
      <ul>
        {results.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}
