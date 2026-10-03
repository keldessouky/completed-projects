import { useState, type SubmitEvent } from 'react';

interface DockingFormProps {
  onRequest: (ship: string, bay: number) => void;
}

// On submit:
//   • never let the browser reload the page
//   • blank ship name → show <p role="alert">Ship name required</p>, don't call onRequest
//   • otherwise → onRequest(trimmed ship name, bay as a number),
//                 hide the alert, and clear the ship input (keep the bay)
export function DockingForm({ onRequest }: DockingFormProps) {
  const [ship, setShip] = useState('');
  const [bay, setBay] = useState('1');

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    onRequest(ship, bay);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name="ship" placeholder="Ship" value={ship} onChange={(e) => setShip(e.target.value)} />
      <input name="bay" type="number" min={1} value={bay} onChange={(e) => setBay(e.target.value)} />
      <button type="submit">Request docking</button>
    </form>
  );
}
