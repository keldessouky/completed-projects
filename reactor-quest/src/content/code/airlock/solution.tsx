import { useState } from 'react';

interface AirlockProps {
  initiallyOpen?: boolean;
  onChange?: (open: boolean) => void;
}

export function Airlock({ initiallyOpen = false, onChange }: AirlockProps) {
  const [open, setOpen] = useState(initiallyOpen);

  function toggle() {
    const next = !open;
    setOpen(next);
    onChange?.(next);
  }

  return (
    <div className="airlock">
      <p className="status">Airlock is {open ? 'open' : 'sealed'}</p>
      <button onClick={toggle}>{open ? 'Close airlock' : 'Open airlock'}</button>
    </div>
  );
}
