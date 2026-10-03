// BOSS — the station event bus.
// `E` maps each event name to its payload type, for example:
//   { dock: { ship: string }; undock: { ship: string; reason: string } }
// The compiler should then reject emit('dock', { ship: 7 }) and emit('warp', …).

export interface Bus<E> {
  // Subscribe to one event type. Returns a function that unsubscribes.
  on(type: any, handler: (payload: any) => void): () => void;
  // Call every handler subscribed to `type`, in the order they subscribed.
  emit(type: any, payload: any): void;
}

export function createBus<E>(): Bus<E> {
  // TODO: keep a list of handlers per event type
  return {
    on(type, handler) {
      return () => {};
    },
    emit(type, payload) {},
  };
}
