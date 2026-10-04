import { useState } from 'react';
import { ALL_ITEMS, RARITY_ORDER, type Item, type ItemKind } from '../game/items';
import { TIER_INFO } from '../game/rewards';
import { setSave, useSave } from '../game/store';
import { Markdown } from '../ui/Markdown';
import { Modal } from '../ui/Modal';
import { overlays } from '../ui/overlays';
import { go } from '../ui/router';

type Tab = 'boxes' | 'collection' | 'codex' | 'wardrobe';

export function LootScreen({ tab: initial }: { tab?: string }) {
  const save = useSave();
  // The tab lives in the URL, so links and the back button work.
  const tab: Tab = (['boxes', 'collection', 'codex', 'wardrobe'] as Tab[]).find((t) => t === initial) ?? 'boxes';
  const [reading, setReading] = useState<Item | null>(null);
  const owned = (kind: ItemKind) => ALL_ITEMS.filter((i) => i.kind === kind);
  const ownedCount = Object.keys(save.items).length;

  return (
    <div className="loot-screen">
      <section className="panel loot-head">
        <div>
          <p className="kicker">Inventory</p>
          <h2>Loot</h2>
          <p className="muted">{save.boxes.length} unopened box{save.boxes.length === 1 ? '' : 'es'} · {ownedCount} of {ALL_ITEMS.length} items found · 🪙 {save.gold} gold · 🎟 {save.hintTokens} hint tokens</p>
        </div>
        <div className="tabs pill-tabs" role="tablist">
          {(['boxes', 'collection', 'codex', 'wardrobe'] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => go(`/loot/${t}`)}>
              {t === 'boxes' ? `Boxes (${save.boxes.length})` : t === 'collection' ? 'Collection' : t === 'codex' ? 'Codex' : 'Wardrobe'}
            </button>
          ))}
        </div>
      </section>

      {tab === 'boxes' && (
        <section className="panel">
          {save.boxes.length === 0 ? (
            <p className="muted">No boxes right now. Clear levels, earn achievements, complete daily quests, and win over viewers to earn more.</p>
          ) : (
            <>
              <div className="modal-actions left">
                <button className="btn primary" onClick={() => overlays.openBoxes(save.boxes.map((b) => b.id))}>Open all {save.boxes.length}</button>
              </div>
              <ul className="box-list">
                {save.boxes.map((b) => (
                  <li key={b.id} style={{ ['--tone' as string]: TIER_INFO[b.tier].color }}>
                    <span className="box-chip">🎁</span>
                    <div>
                      <b>{TIER_INFO[b.tier].name} Box</b>
                      <span className="muted small">{b.source}</span>
                    </div>
                    <button className="btn small-btn" onClick={() => overlays.openBoxes([b.id])}>Open</button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {tab === 'collection' && (
        <section className="panel">
          <p className="muted small">Collectibles from loot boxes. Some are common. Some are legendary. All of them are things real developers will recognise.</p>
          <ul className="item-grid">
            {[...owned('collectible')].sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity)).map((it) => {
              const count = save.items[it.id] ?? 0;
              return (
                <li key={it.id} className={`item-card ${it.rarity} ${count ? '' : 'missing'}`}>
                  <span className="item-icon">{count ? it.icon : '❔'}</span>
                  <b>{count ? it.name : '???'}</b>
                  <span className="rarity-tag">{it.rarity}{count > 1 ? ` ×${count}` : ''}</span>
                  {count > 0 && <span className="muted small">{it.description}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'codex' && (
        <section className="panel">
          <p className="muted small">Codex scrolls are cheat sheets you keep forever. Each floor's boss guarantees one. Others turn up in loot boxes.</p>
          <ul className="codex-list">
            {owned('scroll').map((it) => {
              const have = !!save.items[it.id];
              return (
                <li key={it.id} className={`item-card ${it.rarity} ${have ? '' : 'missing'}`}>
                  <span className="item-icon">{have ? '📜' : '🔒'}</span>
                  <b>{have ? it.name : 'Undiscovered scroll'}</b>
                  <span className="rarity-tag">{it.rarity}</span>
                  {have && <button className="btn small-btn" onClick={() => setReading(it)}>Read</button>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {tab === 'wardrobe' && (
        <section className="panel wardrobe">
          {(['title', 'theme', 'hat'] as const).map((kind) => (
            <div key={kind}>
              <h3>{kind === 'title' ? 'Titles' : kind === 'theme' ? 'Editor themes' : 'Companion hats'}</h3>
              {kind === 'hat' && !save.pet && <p className="muted small">You'll meet your companion after Floor 1's boss.</p>}
              <ul className="item-grid">
                {owned(kind).map((it) => {
                  const have = !!save.items[it.id];
                  const equipped = kind === 'title' ? save.equipped.title === it.id : kind === 'theme' ? save.equipped.theme === it.id : save.equipped.hat === it.id;
                  return (
                    <li key={it.id} className={`item-card ${it.rarity} ${have ? '' : 'missing'} ${equipped ? 'equipped' : ''}`}>
                      <span className="item-icon">{have ? it.icon : '🔒'}</span>
                      <b>{have || it.price ? it.name : '???'}</b>
                      <span className="rarity-tag">{it.rarity}{!have && it.price ? ` · ${it.price} gold in the Safe Room` : ''}</span>
                      {have && (
                        <button
                          className="btn small-btn"
                          disabled={kind === 'hat' && !save.pet}
                          onClick={() =>
                            setSave((s) => ({
                              ...s,
                              equipped: kind === 'title' ? { ...s.equipped, title: it.id } : kind === 'theme' ? { ...s.equipped, theme: it.id } : { ...s.equipped, hat: equipped ? null : it.id },
                            }))
                          }
                        >
                          {equipped ? (kind === 'hat' ? 'Take off' : 'Equipped') : 'Equip'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}

      {reading && (
        <Modal title={reading.name} onClose={() => setReading(null)} wide>
          <Markdown text={reading.body ?? ''} />
          <div className="modal-actions">
            <button className="btn primary" onClick={() => setReading(null)}>Close</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

