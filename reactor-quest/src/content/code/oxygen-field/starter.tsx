import { useState } from 'react';

// Lieutenant Osei uses a screen reader. To her, this console is an input with
// no name, and an error that is never read out. Fix both:
//
// 1. A real label, connected to the input with htmlFor → id:
//      <label htmlFor="oxygen">Oxygen level (%)</label>
//      <input id="oxygen" … />
//    A <p> that just happens to sit nearby isn't connected to anything.
//
// 2. An error people can perceive. When the value is out of range, show
//      <p id="oxygen-error">Oxygen must be between 19 and 23</p>
//    and give the input  aria-invalid="true"  and  aria-describedby="oxygen-error".
//    That links the message to the field, so it's read out when the field has focus.
//    When the value is fine (or empty), show no error and no aria-invalid.

export function OxygenField() {
  const [value, setValue] = useState('');
  const level = Number(value);
  const invalid = value !== '' && !(level >= 19 && level <= 23);

  return (
    <div>
      <p>Oxygen level (%)</p>
      <input value={value} onChange={(e) => setValue(e.target.value)} />
      {invalid && <span style={{ color: 'red' }}>Out of range!</span>}
    </div>
  );
}
