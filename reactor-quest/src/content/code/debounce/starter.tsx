import { useEffect, useState } from 'react';

// Typing "reactor" fires seven requests — one per letter. Wasteful, and rude
// to the server. *Debouncing* waits until the user pauses before acting.

// 1. A hook that returns `value`, but only after it has stopped changing for
//    `delayMs`. Every new value restarts the wait.
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  return value;
}

// 2. A search box that calls onSearch with the debounced text — once per pause,
//    never for the initial empty text, and never twice for the same text.
//      <input aria-label="Search" />
export function SearchBox({ onSearch, delayMs = 300 }: { onSearch: (text: string) => void; delayMs?: number }) {
  const [text, setText] = useState('');

  useEffect(() => {
    if (text) onSearch(text);
  }, [text, onSearch]);

  return <input aria-label="Search" value={text} onChange={(e) => setText(e.target.value)} />;
}
