import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'title' }
  | { name: 'map' }
  | { name: 'level'; id: string }
  | { name: 'arcade' }
  | { name: 'profile' };

export function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  if (parts[0] === 'map') return { name: 'map' };
  if (parts[0] === 'level' && parts[1]) return { name: 'level', id: decodeURIComponent(parts[1]) };
  if (parts[0] === 'arcade') return { name: 'arcade' };
  if (parts[0] === 'profile') return { name: 'profile' };
  return { name: 'title' };
}

export function go(path: string) {
  window.location.hash = `#${path}`;
}

const subscribe = (l: () => void) => {
  window.addEventListener('hashchange', l);
  return () => window.removeEventListener('hashchange', l);
};

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parse(hash);
}
