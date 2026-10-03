import { useState } from 'react';

export function useToggle(initial = false): [boolean, () => void] {
  const [on, setOn] = useState(initial);
  const toggle = () => setOn((o) => !o);
  return [on, toggle];
}

export function LightSwitch({ label }: { label: string }) {
  const [on, toggle] = useToggle();
  return (
    <button className={`switch ${on ? 'on' : 'off'}`} onClick={toggle}>
      {label}: {on ? 'ON' : 'OFF'}
    </button>
  );
}
