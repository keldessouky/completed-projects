export type Item = { name: string; category: string; qty: number; price: number };

const worth = (item: Item) => item.qty * item.price;

export function totalValue(items: Item[]): number {
  return items.reduce((total, item) => total + worth(item), 0);
}

export function lowStock(items: Item[]): string[] {
  return items
    .filter((item) => item.qty < 5)
    .map((item) => item.name)
    .sort();
}

export function unitsByCategory(items: Item[]): Record<string, number> {
  return items.reduce((units: Record<string, number>, item) => {
    units[item.category] = (units[item.category] || 0) + item.qty;
    return units;
  }, {});
}

export function audit(items: Item[]) {
  let mostValuable = "none";
  let best = -1;
  for (const item of items) {
    if (worth(item) > best) {
      best = worth(item);
      mostValuable = item.name;
    }
  }
  return {
    totalValue: totalValue(items),
    lowStock: lowStock(items),
    unitsByCategory: unitsByCategory(items),
    mostValuable,
  };
}
