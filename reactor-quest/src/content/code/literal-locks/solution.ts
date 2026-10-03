export type Door = 'open' | 'closed' | 'locked';

export function next(door: Door): Door {
  if (door === 'open') return 'closed';
  if (door === 'closed') return 'locked';
  return 'open';
}

export function canLock(door: Door): boolean {
  return door === 'closed';
}
