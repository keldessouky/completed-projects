import { useReducer } from 'react';

export type HoldState = { crates: number };

export type HoldAction =
  | { type: 'load'; crates: number }
  | { type: 'unload'; crates: number }
  | { type: 'clear' };

export function holdReducer(state: HoldState, action: HoldAction): HoldState {
  switch (action.type) {
    case 'load':
      return { ...state, crates: state.crates + action.crates };
    case 'unload':
      return { ...state, crates: Math.max(0, state.crates - action.crates) };
    case 'clear':
      return { ...state, crates: 0 };
  }
}

export function CargoHold() {
  const [state, dispatch] = useReducer(holdReducer, { crates: 0 });
  return (
    <div className="cargo-hold">
      <p className="crates">Crates: {state.crates}</p>
      <button onClick={() => dispatch({ type: 'load', crates: 5 })}>Load 5</button>
      <button onClick={() => dispatch({ type: 'unload', crates: 2 })}>Unload 2</button>
      <button onClick={() => dispatch({ type: 'clear' })}>Clear</button>
    </div>
  );
}
