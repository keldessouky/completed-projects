import { JSX } from 'react';
import { Link } from 'react-router-dom';

export function Home(): JSX.Element {
  return (
    <section className="home">
      <h1>Roaming in Rome</h1>
      <p>
        Discover the Eternal City&apos;s most iconic landmarks and build your own travel
        itineraries.
      </p>
      <div className="home-actions">
        <Link className="button" to="/landmarks">
          Browse landmarks
        </Link>
        <Link className="button button-secondary" to="/register">
          Create an account
        </Link>
      </div>
    </section>
  );
}
