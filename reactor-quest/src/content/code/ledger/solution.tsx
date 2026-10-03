import { useState } from 'react';

interface Item {
  id: number;
  name: string;
}

let nextId = 1;

export function Ledger() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');

  function add() {
    const name = text.trim();
    if (!name) return;
    setItems([...items, { id: nextId++, name }]);
    setText('');
  }

  function remove(id: number) {
    setItems(items.filter((item) => item.id !== id));
  }

  return (
    <div className="ledger">
      <input aria-label="Item" value={text} onChange={(e) => setText(e.target.value)} />
      <button onClick={add}>Add</button>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} <button onClick={() => remove(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <p className="total">
        {items.length} {items.length === 1 ? 'item' : 'items'}
      </p>
    </div>
  );
}
