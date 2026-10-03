import { useState } from 'react';

export function Thruster() {
  const [thrust, setThrust] = useState(0);

  return (
    <div className="thruster">
      <p>Thrust: {thrust}</p>
      <button onClick={() => setThrust(Math.max(0, thrust - 1))}>Decrease</button>
      <button onClick={() => setThrust(Math.min(10, thrust + 1))}>Increase</button>
    </div>
  );
}
