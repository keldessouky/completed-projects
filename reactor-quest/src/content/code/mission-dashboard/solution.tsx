import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

export type Ship = { id: string; name: string; status: 'docked' | 'in-flight'; crew: number };
type Filter = 'all' | 'docked' | 'in-flight';

type Load = { status: 'loading' } | { status: 'failed'; message: string } | { status: 'loaded'; ships: Ship[] };

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'docked', label: 'Docked' },
  { value: 'in-flight', label: 'In flight' },
];

export function MissionDashboard({ loadShips }: { loadShips: () => Promise<Ship[]> }) {
  const [load, setLoad] = useState<Load>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    setLoad({ status: 'loading' });
    loadShips().then(
      (ships) => !ignore && setLoad({ status: 'loaded', ships }),
      (e: unknown) => !ignore && setLoad({ status: 'failed', message: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      ignore = true;
    };
  }, [loadShips, attempt]);

  const ships = load.status === 'loaded' ? load.ships : [];
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ships
      .filter((s) => (filter === 'all' || s.status === filter) && s.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [ships, query, filter]);

  if (load.status === 'loading') return <p className="loading">Loading fleet…</p>;
  if (load.status === 'failed') {
    return (
      <div>
        <p role="alert">Fleet unavailable: {load.message}</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      </div>
    );
  }

  const open = ships.find((s) => s.id === openId);
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Escape') setOpenId(null);
  };

  return (
    <div className="dashboard">
      <input aria-label="Search ships" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="filters">
        {FILTERS.map((f) => (
          <button key={f.value} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
            {f.label}
          </button>
        ))}
      </div>
      <p className="summary">
        {visible.length} of {ships.length} ships
      </p>
      {visible.length === 0 ? (
        <p className="empty">No ships match</p>
      ) : (
        <ul>
          {visible.map((s) => (
            <li key={s.id}>
              <button onClick={() => setOpenId(s.id)}>{s.name}</button>
            </li>
          ))}
        </ul>
      )}
      {open && (
        <aside aria-label="Ship details" onKeyDown={onKeyDown}>
          <h3>{open.name}</h3>
          <p>
            {open.crew} crew · {open.status === 'docked' ? 'docked' : 'in flight'}
          </p>
          <button onClick={() => setOpenId(null)}>Close</button>
        </aside>
      )}
    </div>
  );
}
