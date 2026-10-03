// Airlock doors have exactly three states. A plain `string` lets typos like
// "Open" or "ajar" through. Replace it with a union of string literals.
export type Door = string;

// Cycle: open → closed → locked → open
export function next(door: Door): Door {
  if (door === 'open') return 'closed';
  if (door === 'closed') return 'locked';
  return 'open';
}

// Only a closed door can be locked.
export function canLock(door: Door): boolean {
  return door === 'closed';
}
