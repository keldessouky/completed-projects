import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}

export function SearchBox({ onSearch, delayMs = 300 }: { onSearch: (text: string) => void; delayMs?: number }) {
  const [text, setText] = useState('');
  const debounced = useDebouncedValue(text, delayMs);

  useEffect(() => {
    if (debounced) onSearch(debounced);
  }, [debounced, onSearch]);

  return <input aria-label="Search" value={text} onChange={(e) => setText(e.target.value)} />;
}
