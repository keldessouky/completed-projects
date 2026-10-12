// Which printing's art to show: the classic printing, or the coolest special version
// (serialized, borderless, showcase, …), plus per-card picks from the card panel.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Card, Variant } from '../data/cards';

export type ArtMode = 'classic' | 'cool';

interface ArtState {
  mode: ArtMode;
  setMode: (m: ArtMode) => void;
  /** card id → chosen printing id (the card's own id means "classic"). */
  picks: Record<string, string>;
  pick: (card: Card, printingId: string) => void;
}

const KEY = 'multiverse-duel:art';
const ArtContext = createContext<ArtState>({ mode: 'classic', setMode: () => {}, picks: {}, pick: () => {} });

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
  const value = useMemo(() => ({ ...state, setMode, pick }), [state, setMode, pick]);
  return <ArtContext.Provider value={value}>{children}</ArtContext.Provider>;
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
