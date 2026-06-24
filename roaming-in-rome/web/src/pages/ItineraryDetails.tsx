import { JSX, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { landmarkImageUrl } from '../api/assets';
import { itinerariesApi } from '../api/itineraries';
import { Landmark } from '../types';

export function ItineraryDetails(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const itineraryId = Number(id);

  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!Number.isInteger(itineraryId)) {
      setError('Itinerary not found.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setLandmarks(await itinerariesApi.getLandmarks(itineraryId));
    } catch {
      setError('Could not load this itinerary.');
    } finally {
      setLoading(false);
    }
  }, [itineraryId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleRemove(landmarkId: number): Promise<void> {
    try {
      await itinerariesApi.removeLandmark(itineraryId, landmarkId);
      await refresh();
    } catch {
      setError('Could not remove that landmark.');
    }
  }

  if (loading) {
    return (
      <p className="status" role="status">
        Loading…
      </p>
    );
  }
  if (error) {
    return (
      <p className="status status-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <section className="itinerary-details">
      <p>
        <Link to="/itineraries">← Back to my itineraries</Link>
      </p>
      <h1>Itinerary stops</h1>

      {landmarks.length === 0 && (
        <p className="status">
          No landmarks yet. Browse the <Link to="/landmarks">landmarks</Link> and add some.
        </p>
      )}

      <div className="card-grid">
        {landmarks.map((landmark) => (
          <div key={landmark.id} className="landmark-card">
            <Link to={`/landmarks/${landmark.id}`}>
              <img src={landmarkImageUrl(landmark.img)} alt={landmark.name} loading="lazy" />
              <div className="landmark-card-body">
                <h2>{landmark.name}</h2>
                <p>{landmark.summary}</p>
              </div>
            </Link>
            <button
              type="button"
              className="link-button danger"
              onClick={() => handleRemove(landmark.id)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
