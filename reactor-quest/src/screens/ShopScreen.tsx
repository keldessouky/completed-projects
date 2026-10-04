import { useState } from 'react';
import { buy, classInfo, PETS, WARES, CLASS_CHANGE_PRICE } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, setSave, useSave } from '../game/store';
import { ClassPicker } from '../ui/Offers';
import { overlays } from '../ui/overlays';

export function ShopScreen() {
  const save = useSave();
  const [classOpen, setClassOpen] = useState(false);
  const [petName, setPetName] = useState(save.pet?.name ?? '');
  const cls = classInfo(save.classId);

  return (
    <div className="shop">
      <section className="panel shop-head">
        <p className="kicker">Safe Room</p>
        <h2>The Safe Room</h2>
        <p>
          <b>SHOPKEEPER:</b> <i>Welcome, welcome! No bosses in here, no compilers, no viewers — well, a few viewers. Spend your hard-earned gold. Everything's honestly priced. Mostly.</i>
        </p>
        <p className="wallet">🪙 <b>{save.gold}</b> gold · 🎟 {save.hintTokens} tokens · 🚀 {save.boosts} boosts</p>
      </section>

      <section className="panel">
        <h3>Wares</h3>
        <ul className="ware-grid">
          {WARES.map((w) => {
            const owned = w.kind === 'item' && !!save.items[w.itemId];
            const affordable = save.gold >= w.price;
            return (
              <li key={w.id} className={`ware ${owned ? 'owned' : ''}`}>
                <span className="item-icon">{w.icon}</span>
                <b>{w.name}</b>
                <span className="muted small">{w.description}</span>
                <button
                  className="btn small-btn"
                  disabled={owned || !affordable}
                  onClick={() => {
                    const events = act((s) => buy(s, w.id));
                    if (events) sfx.unlock();
                    if (w.kind === 'box') overlays.openBoxes(events.flatMap((e) => (e.kind === 'box' ? [e.box.id] : [])));
                  }}
                >
                  {owned ? 'Owned' : `${w.price} gold`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="panel shop-services">
        <div>
          <h3>Retraining</h3>
          {cls ? (
            <p>You are a <b>{cls.icon} {cls.name}</b>: {cls.perk}</p>
          ) : (
            <p className="muted">You'll choose a class after clearing Floor 3: Modern Systems.</p>
          )}
          <button className="btn" disabled={!cls} onClick={() => setClassOpen(true)}>Change class ({CLASS_CHANGE_PRICE} gold)</button>
        </div>
        <div>
          <h3>Companion</h3>
          {save.pet ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSave((s) => (s.pet ? { ...s, pet: { ...s.pet, name: petName.trim().slice(0, 20) || s.pet.name } } : s));
              }}
            >
              <p>{PETS.find((p) => p.kind === save.pet!.kind)!.icon} <b>{save.pet.name}</b> is napping in the corner.</p>
              <label htmlFor="rename" className="field-label">Rename</label>
              <input id="rename" className="text-input" value={petName} maxLength={20} onChange={(e) => setPetName(e.target.value)} />
              <button className="btn small-btn" type="submit">Rename (free)</button>
            </form>
          ) : (
            <p className="muted">A companion will find you after Floor 1's boss.</p>
          )}
        </div>
      </section>
      {classOpen && <ClassPicker onDone={() => setClassOpen(false)} />}
    </div>
  );
}
