import { FormEvent, JSX, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { itinerariesApi } from '../api/itineraries';
import { Itinerary } from '../types';

export function Itineraries(): JSX.Element {
  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItineraries(await itinerariesApi.listMine());
    } catch {
      setError('Could not load your itineraries.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleCreate(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    await itinerariesApi.create(name);
    setNewName('');
    await refresh();
  }

  async function handleDelete(id: number): Promise<void> {
    await itinerariesApi.remove(id);
    await refresh();
  }

  return (
    <section className="itineraries">
      <h1>My Itineraries</h1>

      <form className="inline-form" onSubmit={handleCreate}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New itinerary name"
          maxLength={32}
        />
        <button className="button" type="submit">
          Create
        </button>
      </form>

      {loading && <p className="status">Loading…</p>}
      {error && <p className="status status-error">{error}</p>}

      {!loading && !error && itineraries.length === 0 && (
        <p className="status">No itineraries yet — create one above.</p>
      )}

      <ul className="itinerary-list">
        {itineraries.map((itinerary) => (
          <li key={itinerary.id} className="itinerary-row card">
            <Link to={`/itineraries/${itinerary.id}`}>{itinerary.name}</Link>
            <button
              type="button"
              className="link-button danger"
              onClick={() => handleDelete(itinerary.id)}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
