import { useReducer } from 'react';

// useReducer keeps state, like useState, but every change goes through ONE
// function you write, the *reducer*:
//
//   reducer(currentState, action) → nextState
//
// Components don't change the state themselves. They *dispatch* an action that
// describes what happened, and the reducer decides what it means:
//
//   const [state, dispatch] = useReducer(holdReducer, { crates: 0 });
//   <button onClick={() => dispatch({ type: 'load', crates: 5 })}>Load 5</button>
//
// The cargo hold's actions are already typed below. Your jobs:
//   1. Write the reducer:
//        load   → crates goes up by action.crates
//        unload → crates goes down by action.crates, but never below 0
//        clear  → crates goes back to 0
//      Always return a NEW object, like { ...state, crates: 7 }. Never change `state`.
//   2. Wire up the "Unload 2" and "Clear" buttons. "Load 5" is done for you.

export type HoldState = { crates: number };

export type HoldAction =
  | { type: 'load'; crates: number }
  | { type: 'unload'; crates: number }
  | { type: 'clear' };

export function holdReducer(state: HoldState, action: HoldAction): HoldState {
  return state;
}

export function CargoHold() {
  const [state, dispatch] = useReducer(holdReducer, { crates: 0 });
  return (
    <div className="cargo-hold">
      <p className="crates">Crates: {state.crates}</p>
      <button onClick={() => dispatch({ type: 'load', crates: 5 })}>Load 5</button>
      <button>Unload 2</button>
      <button>Clear</button>
    </div>
  );
}
