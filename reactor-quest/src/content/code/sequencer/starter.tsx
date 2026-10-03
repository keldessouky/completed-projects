import { useReducer } from 'react';

export interface ReactorState {
  status: 'offline' | 'priming' | 'online' | 'scrammed';
  temp: number;
}

// TODO: one member per action — prime, ignite, heat (carries `by: number`), scram
export type Action = { type: string };

// The rules:
//   prime  — offline → priming           (otherwise: no change)
//   ignite — priming → online            (otherwise: no change)
//   heat   — only while online: temp += by; above 1000 the core scrams
//   scram  — from any status → scrammed, temp back to 0
// Return a NEW state object. Never modify `state`.
export function reactorReducer(state: ReactorState, action: Action): ReactorState {
  return state;
}

export const INITIAL: ReactorState = { status: 'offline', temp: 0 };

// <p className="status">online · 300°</p>  and four buttons:
// Prime, Ignite, Heat (+300), Scram
export function ReactorPanel() {
  const [state, dispatch] = useReducer(reactorReducer, INITIAL);
  return (
    <div className="reactor-panel">
      <p className="status">
        {state.status} · {state.temp}°
      </p>
      <button>Prime</button>
      <button>Ignite</button>
      <button>Heat</button>
      <button>Scram</button>
    </div>
  );
}
