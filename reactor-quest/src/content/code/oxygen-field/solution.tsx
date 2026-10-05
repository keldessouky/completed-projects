import { useState } from 'react';

export function OxygenField() {
  const [value, setValue] = useState('');
  const level = Number(value);
  const invalid = value !== '' && !(level >= 19 && level <= 23);

  return (
    <div>
      <label htmlFor="oxygen">Oxygen level (%)</label>
      <input
        id="oxygen"
        value={value}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? 'oxygen-error' : undefined}
        onChange={(e) => setValue(e.target.value)}
      />
      {invalid && <p id="oxygen-error">Oxygen must be between 19 and 23</p>}
    </div>
  );
}
