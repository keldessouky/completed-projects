import { useEffect, useState } from 'react';

export function ShipSearch({ search }: { search: (query: string) => Promise<string[]> }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    if (query === '') {
      setResults([]);
      return;
    }
    let stale = false;
    search(query).then((found) => {
      if (!stale) setResults(found);
    });
    return () => {
      stale = true;
    };
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
