import { useEffect, useState } from 'react';

type State =
  | { status: 'loading' }
  | { status: 'loaded'; crew: string[] }
  | { status: 'failed'; message: string };

export function CrewLoader({ load }: { load: () => Promise<string[]> }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let ignore = false;
    setState({ status: 'loading' });
    load().then(
      (crew) => {
        if (!ignore) setState({ status: 'loaded', crew });
      },
      (error: unknown) => {
        if (!ignore) setState({ status: 'failed', message: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      ignore = true;
    };
  }, [load, attempt]);

  if (state.status === 'loading') return <p className="loading">Loading crew…</p>;
  if (state.status === 'failed') {
    return (
      <div>
        <p role="alert">Couldn't load crew: {state.message}</p>
        <button onClick={() => setAttempt((a) => a + 1)}>Retry</button>
      </div>
    );
  }
  return (
    <ul>
      {state.crew.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}
