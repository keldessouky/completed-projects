import { useState, type SubmitEvent } from 'react';

interface DockingFormProps {
  onRequest: (ship: string, bay: number) => void;
}

export function DockingForm({ onRequest }: DockingFormProps) {
  const [ship, setShip] = useState('');
  const [bay, setBay] = useState('1');
  const [error, setError] = useState(false);

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = ship.trim();
    if (!name) {
      setError(true);
      return;
    }
    setError(false);
    onRequest(name, Number(bay));
    setShip('');
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="ship" placeholder="Ship" value={ship} onChange={(e) => setShip(e.target.value)} />
      <input name="bay" type="number" min={1} value={bay} onChange={(e) => setBay(e.target.value)} />
      <button type="submit">Request docking</button>
      {error && <p role="alert">Ship name required</p>}
    </form>
  );
}
