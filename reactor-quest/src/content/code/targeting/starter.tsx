import { useRef, useState } from 'react';

// <input aria-label="Target" />
// <button>Lock on</button>   → moves keyboard focus into the input
// <button>Fire</button>      → counts a shot; <p className="shots">Shots: 3</p>
//
// The ref isn't connected to anything yet, and TypeScript doesn't know what
// it will point at.
export function Targeting() {
  const inputRef = useRef(null);
  const [shots, setShots] = useState(0);

  function lockOn() {
    inputRef.current.focus();
  }

  return (
    <div className="targeting">
      <input aria-label="Target" />
      <button onClick={lockOn}>Lock on</button>
      <button onClick={() => setShots(shots + 1)}>Fire</button>
      <p className="shots">Shots: {shots}</p>
    </div>
  );
}
