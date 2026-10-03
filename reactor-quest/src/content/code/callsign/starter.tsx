import { useState } from 'react';

// <input aria-label="Callsign" />
// <p className="preview">Callsign: NOVA</p>   (upper-cased; "Callsign: —" when empty)
// <p className="count">4/12</p>
// Callsigns are at most 12 characters: typing past that is ignored.

export function CallsignInput() {
  const [value, setValue] = useState('');

  function handleChange(event) {
    // TODO
  }

  return (
    <div className="callsign">
      <input aria-label="Callsign" />
      <p className="preview">Callsign: —</p>
      <p className="count">0/12</p>
    </div>
  );
}
