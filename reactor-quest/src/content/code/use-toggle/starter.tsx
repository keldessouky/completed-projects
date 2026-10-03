import { useState } from 'react';

// A custom hook: a boolean plus a function that flips it.
//   const [on, toggle] = useToggle();      starts false
//   const [on, toggle] = useToggle(true);  starts true
export function useToggle(initial = false) {
  const [on, setOn] = useState(initial);
  const toggle = () => setOn(!on);
  return [on, toggle];
}

// <button className="switch on|off">{label}: ON|OFF</button>
export function LightSwitch({ label }: { label: string }) {
  const [on, toggle] = useToggle();
  return (
    <button className={`switch ${on ? 'on' : 'off'}`} onClick={toggle}>
      {label}: {on ? 'ON' : 'OFF'}
    </button>
  );
}
