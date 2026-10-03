import type { ReactNode } from 'react';

interface ListProps<T> {
  items: T[];
  keyOf: (item: T) => string | number;
  render: (item: T) => ReactNode;
  empty?: ReactNode;
}

export function List<T>({ items, keyOf, render, empty = 'Nothing here' }: ListProps<T>) {
  if (items.length === 0) return <p className="empty">{empty}</p>;
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={keyOf(item)}>{render(item)}</li>
      ))}
    </ul>
  );
}
