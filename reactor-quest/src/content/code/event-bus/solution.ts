export interface Bus<E> {
  on<K extends keyof E>(type: K, handler: (payload: E[K]) => void): () => void;
  emit<K extends keyof E>(type: K, payload: E[K]): void;
}

// For each event name, the list of handlers that take that event's payload.
type Handlers<E> = { [K in keyof E]?: Array<(payload: E[K]) => void> };

export function createBus<E>(): Bus<E> {
  const handlers: Handlers<E> = {};
  return {
    on(type, handler) {
      const list = (handlers[type] ??= []);
      list.push(handler);
      return () => {
        handlers[type] = handlers[type]?.filter((h) => h !== handler);
      };
    },
    emit(type, payload) {
      for (const handler of handlers[type] ?? []) handler(payload);
    },
  };
}
