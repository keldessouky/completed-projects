import { JSX, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { landmarkImageUrl } from '../api/assets';
import { itinerariesApi } from '../api/itineraries';
import { landmarksApi } from '../api/landmarks';
import { useAsync } from '../hooks/useAsync';
import { useAppSelector } from '../store/hooks';
import { Itinerary } from '../types';

export function LandmarkDetails(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const landmarkId = Number(id);
  const token = useAppSelector((state) => state.auth.token);

  const { data: landmark, loading, error } = useAsync(
    () => landmarksApi.get(landmarkId),
    [landmarkId],
  );

  const [itineraries, setItineraries] = useState<Itinerary[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<number | ''>('');
  const [addStatus, setAddStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // Only authenticated users can add to an itinerary, so only then do we load
  // them. On logout (token cleared) drop any previously loaded itineraries.
  useEffect(() => {
    if (!token) {
      setItineraries([]);
      return;
    }
    itinerariesApi
      .listMine()
      .then(setItineraries)
      .catch(() => setItineraries([]));
  }, [token]);

  async function handleAdd(): Promise<void> {
    if (selectedItinerary === '') return;
    setAddStatus(null);
    setAdding(true);
    try {
      await itinerariesApi.addLandmark(selectedItinerary, landmarkId);
      setAddStatus('Added to your itinerary!');
      setSelectedItinerary('');
    } catch {
      setAddStatus('Could not add to that itinerary.');
    } finally {
      setAdding(false);
    }
  }

  if (loading) return <p className="status">Loading…</p>;
  if (error || !landmark) return <p className="status status-error">{error ?? 'Not found'}</p>;

  return (
    <section className="landmark-details">
      <h1>{landmark.name}</h1>
      <p className="summary">{landmark.summary}</p>

      <img className="hero" src={landmarkImageUrl(landmark.img)} alt={landmark.name} />

      <p className="description">{landmark.description}</p>

      {landmark.images.length > 0 && (
        <div className="gallery">
          {landmark.images.map((image) => (
            <img key={image} src={landmarkImageUrl(image)} alt={landmark.name} loading="lazy" />
          ))}
        </div>
      )}

      {landmark.mapLink && (
        <div className="map">
          <iframe
            title={`Map of ${landmark.name}`}
            src={landmark.mapLink}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}

      {token && itineraries.length > 0 && (
        <div className="add-to-itinerary card">
          <label>
            Add to itinerary
            <select
              value={selectedItinerary}
              onChange={(e) =>
                setSelectedItinerary(e.target.value === '' ? '' : Number(e.target.value))
              }
            >
              <option value="">Choose an itinerary…</option>
              {itineraries.map((itinerary) => (
                <option key={itinerary.id} value={itinerary.id}>
                  {itinerary.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button"
            type="button"
            onClick={handleAdd}
            disabled={selectedItinerary === '' || adding}
          >
            {adding ? 'Adding…' : 'Add'}
          </button>
          {addStatus && <p className="form-aside">{addStatus}</p>}
        </div>
      )}
    </section>
  );
}
