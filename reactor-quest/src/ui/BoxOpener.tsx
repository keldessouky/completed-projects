import { useEffect, useState } from 'react';
import { TIER_INFO, checkAchievements, openBox, type Loot } from '../game/rewards';
import { sfx } from '../game/sound';
import { act, getSave, useSave } from '../game/store';
import type { Box } from '../game/progress';
import { overlays, useOverlays } from './overlays';

const RARITY_COLOR: Record<string, string> = {
  common: '#9aa7c2', uncommon: '#4ade80', rare: '#4fd1ff', epic: '#b794f6', legendary: '#ff8a3d', celestial: '#ff8ad8',
};

function LootLine({ loot, delay }: { loot: Loot; delay: number }) {
  const style = { animationDelay: `${delay}s` };
  if (loot.kind === 'gold') return <li className="loot gold" style={style}><span className="loot-icon">🪙</span><b>{loot.amount} gold</b>{loot.note && <span className="muted small"> — {loot.note}</span>}</li>;
  if (loot.kind === 'tokens') return <li className="loot" style={style}><span className="loot-icon">🎟</span><b>{loot.amount} hint token{loot.amount > 1 ? 's' : ''}</b><span className="muted small"> — reveal hints without losing stars</span></li>;
  if (loot.kind === 'boost') return <li className="loot" style={style}><span className="loot-icon">🚀</span><b>XP boost ×{loot.amount}</b><span className="muted small"> — +50% XP on your next {loot.amount} clears</span></li>;
  const it = loot.item;
  return (
    <li className={`loot item ${it.rarity}`} style={{ ...style, ['--rarity' as string]: RARITY_COLOR[it.rarity] }}>
      <span className="loot-icon">{it.icon}</span>
      <div>
        <b>{it.name}</b> {loot.isNew && <span className="new-tag">NEW</span>}
        <span className="rarity-tag">{it.rarity} {it.kind === 'collectible' ? '' : it.kind}</span>
        <div className="muted small">{it.kind === 'scroll' ? 'Added to your Codex — read it any time in Loot.' : it.description}</div>
      </div>
    </li>
  );
}

export function BoxOpener() {
  const { boxes } = useOverlays();
  const save = useSave();
  const [stage, setStage] = useState<'closed' | 'shaking' | 'open'>('closed');
  const [result, setResult] = useState<{ box: Box; loot: Loot[] } | null>(null);
  const queue = (boxes ?? []).filter((id) => save.boxes.some((b) => b.id === id));
  const current = result?.box ?? save.boxes.find((b) => b.id === queue[0]);

  useEffect(() => {
    setStage('closed');
    setResult(null);
  }, [boxes]);

  if (!boxes || !current) return null;

  function open() {
    if (stage !== 'closed') return;
    setStage('shaking');
    sfx.click();
    setTimeout(() => {
      let opened: { box: Box; loot: Loot[] } | null = null;
      act((s) => {
        const r = openBox(s, current!.id, Math.random);
        if (!r) return null;
        opened = { box: r.box, loot: r.loot };
        // Opening counts toward achievements (Unboxing Video, Box Addict, Legendary Pull…).
        return checkAchievements(r.save);
      });
      setResult(opened);
      setStage('open');
      sfx.pass();
      if (Math.random() < 0.5) overlays.petSay(['*shakes the box*', '*wants the box, not the loot*', '*sniffs the loot*'][Math.floor(Math.random() * 3)]);
    }, 700);
  }

  function next() {
    const remaining = (boxes ?? []).filter((id) => getSave().boxes.some((b) => b.id === id));
    setResult(null);
    setStage('closed');
    if (!remaining.length) overlays.closeBoxes();
    else overlays.openBoxes(remaining);
  }

  const tier = TIER_INFO[current.tier];
  const left = queue.filter((id) => id !== current.id).length;
  return (
    <div className="modal-backdrop" onClick={() => stage !== 'shaking' && overlays.closeBoxes()}>
      <div className="modal box-modal" role="dialog" aria-modal="true" aria-label={`${tier.name} box`} style={{ ['--tone' as string]: tier.color }} onClick={(e) => e.stopPropagation()}>
        <p className="kicker">{current.source}</p>
        <h3>{tier.name} Box</h3>
        {stage !== 'open' ? (
          <button className={`loot-box ${current.tier} ${stage}`} onClick={open} aria-label="Open the box">
            <span className="lid" />
            <span className="body">🎁</span>
            <span className="glow" />
          </button>
        ) : (
          <ul className="loot-list">
            {result?.loot.map((l, i) => <LootLine key={i} loot={l} delay={0.12 * i} />)}
          </ul>
        )}
        <div className="modal-actions">
          {stage === 'closed' && <button className="btn primary" autoFocus onClick={open}>Open it</button>}
          {stage === 'open' && (
            <button className="btn primary" autoFocus onClick={next}>
              {left > 0 ? `Next box (${left} left)` : 'Collect'}
            </button>
          )}
          {stage === 'closed' && <button className="btn ghost" onClick={() => overlays.closeBoxes()}>Later</button>}
        </div>
      </div>
    </div>
  );
}
