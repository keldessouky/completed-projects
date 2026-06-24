import { JSX } from 'react';
import { Link } from 'react-router-dom';
import { landmarkImageUrl } from '../api/assets';
import { landmarksApi } from '../api/landmarks';
import { useAsync } from '../hooks/useAsync';

export function Landmarks(): JSX.Element {
  const { data: landmarks, loading, error } = useAsync(() => landmarksApi.list(), []);

  if (loading) {
    return (
      <p className="status" role="status">
        Loading landmarks…
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
    <section className="landmarks">
      <h1>Landmarks of Rome</h1>
      <div className="card-grid">
        {landmarks?.map((landmark) => (
          <Link key={landmark.id} to={`/landmarks/${landmark.id}`} className="landmark-card">
            <img src={landmarkImageUrl(landmark.img)} alt={landmark.name} loading="lazy" />
            <div className="landmark-card-body">
              <h2>{landmark.name}</h2>
              <p>{landmark.summary}</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
