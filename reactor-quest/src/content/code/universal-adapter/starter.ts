// These helpers "work" — but `any` throws away every type that passes through.
// first([1, 2]) should be known to be a number, not "anything".
// Make them generic.

export function first(items: any[]): any {
  return items[0];
}

export function last(items: any[]): any {
  return items[items.length - 1];
}

// wrap(5) → { value: 5 }
export function wrap(value: any): { value: any } {
  return { value };
}
