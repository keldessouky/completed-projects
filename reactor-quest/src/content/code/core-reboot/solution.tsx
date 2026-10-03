import { useEffect, useReducer, useState } from 'react';

export type Phase = 'idle' | 'charging' | 'ready' | 'online';

interface CoreState {
  phase: Phase;
  charge: number;
}

type CoreAction = { type: 'begin' } | { type: 'tick' } | { type: 'abort' } | { type: 'ignite' };

function coreReducer(state: CoreState, action: CoreAction): CoreState {
  switch (action.type) {
    case 'begin':
      return state.phase === 'idle' ? { phase: 'charging', charge: 0 } : state;
    case 'tick': {
      if (state.phase !== 'charging') return state;
      const charge = Math.min(100, state.charge + 10);
      return { phase: charge === 100 ? 'ready' : 'charging', charge };
    }
    case 'abort':
      return state.phase === 'charging' ? { phase: 'idle', charge: 0 } : state;
    case 'ignite':
      return state.phase === 'ready' ? { ...state, phase: 'online' } : state;
  }
}

interface CoreConsoleProps {
  chargeMs?: number;
  onOnline?: () => void;
}

export function CoreConsole({ chargeMs = 3000, onOnline }: CoreConsoleProps) {
  const [{ phase, charge }, dispatch] = useReducer(coreReducer, { phase: 'idle', charge: 0 });
  const [code, setCode] = useState('');

  useEffect(() => {
    if (phase !== 'charging') return;
    const id = setInterval(() => dispatch({ type: 'tick' }), chargeMs / 10);
    return () => clearInterval(id);
  }, [phase, chargeMs]);

  const authorized = code.trim().toUpperCase() === 'REACT';

  function ignite() {
    dispatch({ type: 'ignite' });
    onOnline?.();
  }

  return (
    <div className="core-console">
      <p className="phase">Phase: {phase}</p>
      <progress value={charge} max={100} />
      <button disabled={phase !== 'idle'} onClick={() => dispatch({ type: 'begin' })}>
        Begin charge
      </button>
      <button disabled={phase !== 'charging'} onClick={() => dispatch({ type: 'abort' })}>
        Abort
      </button>
      <input aria-label="Authorization" value={code} onChange={(e) => setCode(e.target.value)} />
      <button disabled={phase !== 'ready' || !authorized} onClick={ignite}>
        Ignite
      </button>
      {phase === 'online' && <p className="restored">Core online. Station restored.</p>}
    </div>
  );
}
