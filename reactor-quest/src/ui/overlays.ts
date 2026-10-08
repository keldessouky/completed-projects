// App-wide overlays that any screen can open: the box opener, the pet and
// class offers, and the companion's speech bubble.
import { useSyncExternalStore } from 'react';

interface Overlays {
  /** Box ids waiting to be opened, in order (null when the opener is closed). */
  boxes: string[] | null;
  offer: 'pet' | 'class' | 'name' | null;
  petSays: { text: string; at: number } | null;
  /** The player is working on a level: announcements wait until they finish. */
  focus: boolean;
}

let state: Overlays = { boxes: null, offer: null, petSays: null, focus: false };
// Offers earned during a level wait until its victory screen closes.
let pendingOffers: NonNullable<Overlays['offer']>[] = [];
const listeners = new Set<() => void>();

function set(patch: Partial<Overlays>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export const overlays = {
  openBoxes: (ids: string[]) => ids.length && set({ boxes: ids }),
  closeBoxes: () => set({ boxes: null }),
  offer: (what: Overlays['offer']) => {
    if (what === null && pendingOffers.length) set({ offer: pendingOffers.shift()! });
    else set({ offer: what });
  },
  queueOffer: (what: NonNullable<Overlays['offer']>) => {
    if (!pendingOffers.includes(what)) pendingOffers.push(what);
  },
  /** Show the next waiting offer, if any (called when a victory screen closes). */
  flushOffers: () => {
    if (pendingOffers.length && !state.offer) set({ offer: pendingOffers.shift()! });
  },
  petSay: (text: string) => set({ petSays: { text, at: Date.now() } }),
  setFocus: (focus: boolean) => {
    if (state.focus !== focus) set({ focus });
  },
};

export function useOverlays(): Overlays {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
