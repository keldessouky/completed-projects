import { useState } from 'react';
import { CLASSES, PETS, changeClass, checkAchievements, choosePet, CLASS_CHANGE_PRICE } from '../game/rewards';
import type { ClassId, PetKind } from '../game/progress';
import { sfx } from '../game/sound';
import { act, setSave, useSave } from '../game/store';
import { Modal } from './Modal';
import { overlays, useOverlays } from './overlays';

export function Offers() {
  const { offer } = useOverlays();
  if (offer === 'name') return <NameEntry />;
  if (offer === 'pet') return <PetAdoption />;
  if (offer === 'class') return <ClassPicker />;
  return null;
}

function NameEntry() {
  const save = useSave();
  const [name, setName] = useState(save.name);
  const done = () => {
    setSave((s) => ({ ...s, name: name.trim().slice(0, 24) || 'Engineer' }));
    overlays.offer(null);
  };
  return (
    <Modal title="Sign the crew register" onClose={done}>
      <p><b>THE FEED:</b> <i>Welcome to Repair Crew LIVE, the galaxy's favourite show about one person fixing an entire space station with code! What should our four billion viewers call you?</i></p>
      <form onSubmit={(e) => { e.preventDefault(); done(); }}>
        <label htmlFor="crawler-name" className="field-label">Your name</label>
        <input id="crawler-name" className="text-input" autoFocus maxLength={24} value={name} placeholder="Engineer" onChange={(e) => setName(e.target.value)} />
        <div className="modal-actions">
          <button className="btn primary" type="submit">Go live</button>
        </div>
      </form>
    </Modal>
  );
}

function PetAdoption() {
  const [kind, setKind] = useState<PetKind>('drone');
  const [name, setName] = useState('');
  const adopt = () => {
    sfx.unlock();
    act((s) => checkAchievements(choosePet(s, kind, name)));
    overlays.offer(null);
  };
  return (
    <Modal title="A companion wants to join you" onClose={() => overlays.offer(null)} wide>
      <p><b>ARIA:</b> Something followed you out of the Boot Sequence. Several somethings, actually. They've decided you're their engineer now. Pick one: it'll keep you company, cheer when your code runs, and console you when it doesn't.</p>
      <div className="choice-grid">
        {PETS.map((p) => (
          <button key={p.kind} className={`choice ${kind === p.kind ? 'picked' : ''}`} aria-pressed={kind === p.kind} onClick={() => setKind(p.kind)}>
            <span className="choice-icon">{p.icon}</span>
            <b>{p.name}</b>
            <span className="muted small">{p.blurb}</span>
          </button>
        ))}
      </div>
      <label htmlFor="pet-name" className="field-label">Name it</label>
      <input id="pet-name" className="text-input" maxLength={20} value={name} placeholder={PETS.find((p) => p.kind === kind)!.name} onChange={(e) => setName(e.target.value)} />
      <div className="modal-actions">
        <button className="btn ghost" onClick={() => overlays.offer(null)}>Maybe later</button>
        <button className="btn primary" onClick={adopt}>Adopt</button>
      </div>
    </Modal>
  );
}

export function ClassPicker({ onDone }: { onDone?: () => void }) {
  const save = useSave();
  const [pick, setPick] = useState<ClassId>(save.classId ?? 'type-sorcerer');
  const changing = !!save.classId;
  const close = () => (onDone ? onDone() : overlays.offer(null));
  const confirm = () => {
    act((s) => {
      const next = changeClass(s, pick);
      return next ? checkAchievements(next) : null;
    });
    sfx.unlock();
    close();
  };
  return (
    <Modal title={changing ? 'Change your class' : 'Choose your class'} onClose={close} wide>
      {changing ? (
        <p className="muted">Retraining costs {CLASS_CHANGE_PRICE} gold. You have {save.gold}.</p>
      ) : (
        <p><b>THE FEED:</b> <i>Our engineer has conquered JavaScript itself! Tradition demands they choose a CLASS. Choose wisely — or don't, you can retrain later for a fee. We're not monsters. We're a television network.</i></p>
      )}
      <div className="choice-grid">
        {CLASSES.map((c) => (
          <button key={c.id} className={`choice ${pick === c.id ? 'picked' : ''}`} aria-pressed={pick === c.id} onClick={() => setPick(c.id)}>
            <span className="choice-icon">{c.icon}</span>
            <b>{c.name}</b>
            <span className="perk">{c.perk}</span>
            <span className="muted small">{c.flavor}</span>
          </button>
        ))}
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={close}>{changing ? 'Cancel' : 'Decide later'}</button>
        <button className="btn primary" onClick={confirm} disabled={changing && (pick === save.classId || save.gold < CLASS_CHANGE_PRICE)}>
          {changing ? `Retrain (${CLASS_CHANGE_PRICE} gold)` : `Become a ${CLASSES.find((c) => c.id === pick)!.name}`}
        </button>
      </div>
    </Modal>
  );
}
