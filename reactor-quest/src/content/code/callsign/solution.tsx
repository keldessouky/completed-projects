import { useState, type ChangeEvent } from 'react';

const MAX = 12;

export function CallsignInput() {
  const [value, setValue] = useState('');

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    if (next.length <= MAX) setValue(next);
  }

  return (
    <div className="callsign">
      <input aria-label="Callsign" value={value} onChange={handleChange} />
      <p className="preview">Callsign: {value ? value.toUpperCase() : '—'}</p>
      <p className="count">
        {value.length}/{MAX}
      </p>
    </div>
  );
}
