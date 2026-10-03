import { useState } from 'react';

interface AirlockProps {
  initiallyOpen?: boolean;
  onChange?: (open: boolean) => void;
}

// Status:  <p className="status">Airlock is sealed</p>  or  "Airlock is open"
// Button:  <button>Open airlock</button>  or  "Close airlock"
// Each click flips the airlock, then reports the new state with onChange (if given).
export function Airlock({ initiallyOpen = false, onChange }: AirlockProps) {
  const [open, setOpen] = useState();

  function toggle() {
    setOpen(!open);
  }

  return (
    <div className="airlock">
      <p className="status">Airlock is sealed</p>
      <button onClick={toggle}>Open airlock</button>
    </div>
  );
}
