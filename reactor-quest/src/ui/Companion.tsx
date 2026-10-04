// Your pet, floating in the corner, with something to say about your code.
import { useEffect, useState } from 'react';
import { item } from '../game/items';
import { PETS } from '../game/rewards';
import { useSave } from '../game/store';
import { useOverlays } from './overlays';

export function Companion() {
  const save = useSave();
  const { petSays } = useOverlays();
  const [visible, setVisible] = useState<string | null>(null);

  useEffect(() => {
    if (!petSays) return;
    setVisible(petSays.text);
    const t = setTimeout(() => setVisible(null), 3500);
    return () => clearTimeout(t);
  }, [petSays]);

  if (!save.pet) return null;
  const info = PETS.find((p) => p.kind === save.pet!.kind)!;
  const hat = save.equipped.hat ? item(save.equipped.hat).icon : null;
  return (
    <div className="companion" aria-live="polite">
      {visible && (
        <div className="bubble">
          <b>{save.pet.name}</b> {visible}
        </div>
      )}
      <div className="pet" title={`${save.pet.name} the ${info.name}`}>
        {hat && <span className="pet-hat" aria-hidden>{hat}</span>}
        <span aria-hidden>{info.icon}</span>
      </div>
    </div>
  );
}
