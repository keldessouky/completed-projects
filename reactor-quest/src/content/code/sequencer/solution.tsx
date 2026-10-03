import { useReducer } from 'react';

export interface ReactorState {
  status: 'offline' | 'priming' | 'online' | 'scrammed';
  temp: number;
}

export type Action =
  | { type: 'prime' }
  | { type: 'ignite' }
  | { type: 'heat'; by: number }
  | { type: 'scram' };

export function reactorReducer(state: ReactorState, action: Action): ReactorState {
  switch (action.type) {
    case 'prime':
      return state.status === 'offline' ? { ...state, status: 'priming' } : state;
    case 'ignite':
      return state.status === 'priming' ? { ...state, status: 'online' } : state;
    case 'heat': {
      if (state.status !== 'online') return state;
      const temp = state.temp + action.by;
      return temp > 1000 ? { status: 'scrammed', temp: 0 } : { ...state, temp };
    }
    case 'scram':
      return { status: 'scrammed', temp: 0 };
  }
}

export const INITIAL: ReactorState = { status: 'offline', temp: 0 };

export function ReactorPanel() {
  const [state, dispatch] = useReducer(reactorReducer, INITIAL);
  return (
    <div className="reactor-panel">
      <p className="status">
        {state.status} · {state.temp}°
      </p>
      <button onClick={() => dispatch({ type: 'prime' })}>Prime</button>
      <button onClick={() => dispatch({ type: 'ignite' })}>Ignite</button>
      <button onClick={() => dispatch({ type: 'heat', by: 300 })}>Heat</button>
      <button onClick={() => dispatch({ type: 'scram' })}>Scram</button>
    </div>
  );
}
