import { useRef, useState } from 'react';

export function Targeting() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shots, setShots] = useState(0);

  function lockOn() {
    inputRef.current?.focus();
  }

  return (
    <div className="targeting">
      <input aria-label="Target" ref={inputRef} />
      <button onClick={lockOn}>Lock on</button>
      <button onClick={() => setShots(shots + 1)}>Fire</button>
      <p className="shots">Shots: {shots}</p>
    </div>
  );
}
