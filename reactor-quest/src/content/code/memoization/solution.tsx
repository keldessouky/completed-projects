import { memo, useCallback, useMemo, useState } from 'react';

export type Ship = { id: string; name: string };

export const ShipRow = memo(function ShipRow({ ship, onSelect, onRender }: { ship: Ship; onSelect: (id: string) => void; onRender?: (id: string) => void }) {
  onRender?.(ship.id);
  return (
    <li>
      <button onClick={() => onSelect(ship.id)}>{ship.name}</button>
    </li>
  );
});

export function Fleet({ ships, sortShips, onRowRender }: { ships: Ship[]; sortShips: (ships: Ship[]) => Ship[]; onRowRender?: (id: string) => void }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [ticks, setTicks] = useState(0);
  const sorted = useMemo(() => sortShips(ships), [ships, sortShips]);
  const select = useCallback((id: string) => setSelected(id), []);

  return (
    <div>
      <p className="selected">Selected: {selected ?? 'none'}</p>
      <button onClick={() => setTicks((t) => t + 1)}>Refresh clock ({ticks})</button>
      <ul>
        {sorted.map((ship) => (
          <ShipRow key={ship.id} ship={ship} onSelect={select} onRender={onRowRender} />
        ))}
      </ul>
    </div>
  );
}
