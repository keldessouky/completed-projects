import type { ReactNode } from 'react';

// One list component for anything: crew, ships, sensors…
//   <List items={crew} keyOf={(m) => m.id} render={(m) => m.name} />
// The props are typed `any`, so the compiler can't help whoever uses it:
// `render` gets an `any`, and typos sail straight through.
// Make the component generic, so `render` and `keyOf` receive the real item type.

interface ListProps {
  items: any[];
  keyOf: (item: any) => string | number;
  render: (item: any) => ReactNode;
  empty?: ReactNode; // shown instead of the list when there are no items
}

export function List({ items, keyOf, render, empty = 'Nothing here' }: ListProps) {
  return (
    <ul className="list">
      {items.map((item) => (
        <li key={keyOf(item)}>{render(item)}</li>
      ))}
    </ul>
  );
}
