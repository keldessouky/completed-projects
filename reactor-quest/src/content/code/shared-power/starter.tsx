import { useState } from 'react';

// Two components, two copies of the power level. Boost in the controls,
// and the readout never hears about it.
//
// Lift the state up: Reactor owns `power` (starts at 50, stays within 0–100).
// Readout just displays what it's given. Controls just reports clicks.

export function Readout() {
  const [power] = useState(50);
  return <p className="readout">Power: {power}%</p>;
}

export function Controls() {
  const [power, setPower] = useState(50);
  return (
    <div className="controls">
      <button onClick={() => setPower(power + 10)}>Boost</button>
      <button onClick={() => setPower(power - 10)}>Vent</button>
    </div>
  );
}

export function Reactor() {
  return (
    <div className="reactor">
      <Readout />
      <Controls />
    </div>
  );
}
