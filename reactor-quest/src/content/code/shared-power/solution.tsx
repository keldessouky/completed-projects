import { useState } from 'react';

export function Readout({ power }: { power: number }) {
  return <p className="readout">Power: {power}%</p>;
}

interface ControlsProps {
  onBoost: () => void;
  onVent: () => void;
}

export function Controls({ onBoost, onVent }: ControlsProps) {
  return (
    <div className="controls">
      <button onClick={onBoost}>Boost</button>
      <button onClick={onVent}>Vent</button>
    </div>
  );
}

export function Reactor() {
  const [power, setPower] = useState(50);
  return (
    <div className="reactor">
      <Readout power={power} />
      <Controls
        onBoost={() => setPower((p) => Math.min(100, p + 10))}
        onVent={() => setPower((p) => Math.max(0, p - 10))}
      />
    </div>
  );
}
