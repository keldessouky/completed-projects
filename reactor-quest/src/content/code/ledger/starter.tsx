import { useState } from 'react';

interface Item {
  id: number;
  name: string;
}

let nextId = 1;

// <input aria-label="Item" /> <button>Add</button>  → adds the trimmed name (ignores blanks), clears the input
// <ul> with an <li> per item: {name} <button>Remove</button>
// <p className="total">2 items</p>   ("1 item" when there's just one)
export function Ledger() {
  const [items, setItems] = useState<Item[]>([]);
  const [text, setText] = useState('');

  function add() {
    items.push({ id: nextId++, name: text });
    setItems(items);
  }

  function remove(id: number) {
    const index = items.findIndex((item) => item.id === id);
    items.splice(index, 1);
    setItems(items);
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
      <p className="total">{items.length} items</p>
    </div>
  );
}
