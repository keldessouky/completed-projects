export type Deck = "A" | "B" | "C";
export type Bay = 1 | 2 | 3 | 4;

export type BayCode = `${Deck}${Bay}`;

export function isBayCode(s: string): s is BayCode {
  return /^[ABC][1-4]$/.test(s);
}

export function handlerName<E extends string>(event: E): `on${Capitalize<E>}` {
  return `on${event.charAt(0).toUpperCase()}${event.slice(1)}` as `on${Capitalize<E>}`;
}

export type Handlers<E extends string> = { [K in E as `on${Capitalize<K>}`]: () => void };
