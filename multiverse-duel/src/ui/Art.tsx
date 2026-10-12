// Which printing's art to show: the classic printing, or the coolest special version
// (serialized, borderless, showcase, …), plus per-card picks from the card panel.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { imageUrl, VARIANT_NAMES, type Card, type Variant } from '../data/cards';

export type ArtMode = 'classic' | 'cool';

interface ArtState {
  mode: ArtMode;
  setMode: (m: ArtMode) => void;
  /** card id → chosen printing id (the card's own id means "classic"). */
  picks: Record<string, string>;
  pick: (card: Card, printingId: string) => void;
  /** Open the version picker for a card. */
  openVersions: (card: Card) => void;
}

const KEY = 'multiverse-duel:art';
const ArtContext = createContext<ArtState>({ mode: 'classic', setMode: () => {}, picks: {}, pick: () => {}, openVersions: () => {} });

export function ArtProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ mode: ArtMode; picks: Record<string, string> }>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
      if (saved && (saved.mode === 'classic' || saved.mode === 'cool')) return { mode: saved.mode, picks: saved.picks ?? {} };
    } catch {
      /* private mode or bad data */
    }
    return { mode: 'cool', picks: {} };
  });
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  const setMode = useCallback((mode: ArtMode) => setState((s) => ({ ...s, mode })), []);
  const pick = useCallback((card: Card, id: string) => setState((s) => ({ ...s, picks: { ...s.picks, [card.id]: id } })), []);
  const [choosing, setChoosing] = useState<Card | null>(null);
  const openVersions = useCallback((card: Card) => {
    if (!card.id.startsWith('token-')) setChoosing(card);
  }, []);
  const value = useMemo(() => ({ ...state, setMode, pick, openVersions }), [state, setMode, pick, openVersions]);
  return (
    <ArtContext.Provider value={value}>
      {children}
      {choosing && <VersionPicker card={choosing} onClose={() => setChoosing(null)} />}
    </ArtContext.Provider>
  );
}

export const useArtSettings = () => useContext(ArtContext);

/** The printing to draw for this card, and its special version if it is one. */
export function useArt(card: Card): { id: string; variant: Variant | null } {
  const { mode, picks } = useContext(ArtContext);
  const picked = picks[card.id];
  if (picked) {
    const v = card.variants.find((x) => x.id === picked);
    if (v) return { id: v.id, variant: v };
    if (picked === card.id) return { id: card.id, variant: null };
  }
  if (mode === 'cool' && card.variants.length) return { id: card.variants[0].id, variant: card.variants[0] };
  return { id: card.id, variant: null };
}

/** Every printing of a card, big enough to judge; click one to use its art for that card everywhere. */
function VersionPicker({ card, onClose }: { card: Card; onClose: () => void }) {
  const { pick } = useContext(ArtContext);
  const current = useArt(card);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const options = [
    { id: card.id, label: 'Classic', sub: card.set.toUpperCase() },
    ...card.variants.map((v) => ({
      id: v.id,
      label: v.note === '1of1' ? 'Serialized 1 of 1' : VARIANT_NAMES[v.kind],
      sub: `${v.set.toUpperCase()}${v.note && v.note !== '1of1' ? ` · ${v.note}` : ''}`,
    })),
  ];
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide version-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={`Choose art for ${card.name}`}>
        <div className="modal-head">
          <h3>Choose art · {card.fullName}</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">
          {card.variants.length === 0 && <p className="muted">This card has only its classic printing.</p>}
          <div className="version-grid">
            {options.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`version-big ${current.id === o.id ? 'on' : ''}`}
                onClick={() => {
                  pick(card, o.id);
                  onClose();
                }}
              >
                <img src={imageUrl(o.id, 'normal')} alt={`${card.name}: ${o.label}`} loading="lazy" />
                <strong>{o.label}</strong>
                <span className="muted small">{o.sub}{current.id === o.id ? ' · in use' : ''}</span>
              </button>
            ))}
          </div>
          <p className="muted small">Your choice is used everywhere this card appears: hand, battlefield, deck lists and the library.</p>
        </div>
      </div>
    </div>
  );
}
