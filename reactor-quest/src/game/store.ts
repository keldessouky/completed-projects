// The one piece of shared game state: the save. A tiny external store,
// read with useSyncExternalStore and persisted on every change.
import { useSyncExternalStore } from 'react';
import { ACHIEVEMENTS, earnedIds, parseSave, type Achievement, type Save } from './progress';

const KEY = 'reactor-quest/save';

function load(): Save {
  try {
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return parseSave(null);
  }
}

let save = load();
const listeners = new Set<() => void>();
const achievementListeners = new Set<(a: Achievement) => void>();

export function getSave() {
  return save;
}

export function setSave(update: (s: Save) => Save) {
  const before = earnedIds(save);
  save = update(save);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lasts for this session */
  }
  listeners.forEach((l) => l());
  const after = earnedIds(save);
  for (const a of ACHIEVEMENTS) if (after.has(a.id) && !before.has(a.id)) achievementListeners.forEach((l) => l(a));
}

export function useSave(): Save {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => save,
  );
}

export function onAchievement(listener: (a: Achievement) => void) {
  achievementListeners.add(listener);
  return () => {
    achievementListeners.delete(listener);
  };
}
