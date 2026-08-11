/**
 * Fixed-capacity object pool with swap-remove iteration.
 * Everything hot (arrows, particles, units, numerals, enemies) lives in one
 * of these: zero allocations during play, no GC hitches.
 *
 * Iteration contract: loop i from count-1 down to 0 and call release(i)
 * freely — swap-remove keeps the live range dense.
 */
export class Pool<T> {
  readonly items: T[] = [];
  count = 0;

  constructor(readonly capacity: number, factory: (index: number) => T) {
    for (let i = 0; i < capacity; i++) this.items.push(factory(i));
  }

  /** Take the next free slot, or null when the pool is saturated. */
  obtain(): T | null {
    if (this.count >= this.capacity) return null;
    return this.items[this.count++];
  }

  /** Release the live item at index i (swap-remove; order not preserved). */
  release(i: number): void {
    const last = this.count - 1;
    if (i < 0 || i > last) return;
    const tmp = this.items[i];
    this.items[i] = this.items[last];
    this.items[last] = tmp;
    this.count = last;
  }

  releaseAll(): void {
    this.count = 0;
  }
}
