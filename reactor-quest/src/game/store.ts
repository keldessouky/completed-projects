// The one piece of shared game state: the save. A tiny external store, read
// with useSyncExternalStore and persisted on every change. Reward events from
// the engine are broadcast to the UI (for announcements) and logged in the inbox.
import { useSyncExternalStore } from 'react';
import { parseSave, type Save } from './progress';
import { dayOf, ensureQuests, noticesFor, syncReviews, type Result, type Reward } from './rewards';

const KEY = 'reactor-quest/save';

function load(): Save {
  try {
    return parseSave(localStorage.getItem(KEY));
  } catch {
    return parseSave(null);
  }
}

const today = () => dayOf(new Date());
// Every change also brings newly earned review cards into the deck, and today's quests.
const settle = (s: Save) => ensureQuests(syncReviews(s, today()), today());

let save = settle(load());
const listeners = new Set<() => void>();
const rewardListeners = new Set<(events: Reward[]) => void>();

export function getSave() {
  return save;
}

function commit(next: Save) {
  save = settle(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* private mode: progress lasts for this session */
  }
  listeners.forEach((l) => l());
}

/** Replace the save with a plain update (no rewards involved). */
export function setSave(update: (s: Save) => Save) {
  commit(update(save));
}

/** Run a reward-engine action: store the new save, log and announce its events. */
export function act(action: (s: Save) => Result | null): Reward[] {
  const result = action(save);
  if (!result) return [];
  const notices = noticesFor(result.events, Date.now());
  commit(notices.length ? { ...result.save, inbox: [...result.save.inbox, ...notices].slice(-60) } : result.save);
  if (result.events.length) rewardListeners.forEach((l) => l(result.events));
  return result.events;
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

export function onRewards(listener: (events: Reward[]) => void) {
  rewardListeners.add(listener);
  return () => {
    rewardListeners.delete(listener);
  };
}
