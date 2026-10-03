import { memo, useCallback, useMemo, useState } from 'react';

export type Ship = { id: string; name: string };

// The fleet list is slow. Every click anywhere re-sorts thousands of ships and
// re-renders every row. Profile first, then fix exactly what's wasteful:
//
//   - sortShips is expensive: only re-sort when `ships` (or sortShips) changes.
//   - ShipRow should skip re-rendering when its props haven't changed.
//     (onRender is how the tests count row renders — leave that call in.)
//   - That only works if the props really don't change: a new arrow function
//     on every render is a "changed" prop.

export function ShipRow({ ship, onSelect, onRender }: { ship: Ship; onSelect: (id: string) => void; onRender?: (id: string) => void }) {
  onRender?.(ship.id);
  return (
    <li>
      <button onClick={() => onSelect(ship.id)}>{ship.name}</button>
    </li>
  );
}

export function Fleet({ ships, sortShips, onRowRender }: { ships: Ship[]; sortShips: (ships: Ship[]) => Ship[]; onRowRender?: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const sorted = sortShips(ships);

  return (
    <div>
      <p className="selected">Selected: {selected ?? 'none'}</p>
      <button onClick={() => setTicks((t) => t + 1)}>Refresh clock ({ticks})</button>
      <ul>
        {sorted.map((ship) => (
          <ShipRow key={ship.id} ship={ship} onSelect={(id) => setSelected(id)} onRender={onRowRender} />
        ))}
      </ul>
    </div>
  );
}
