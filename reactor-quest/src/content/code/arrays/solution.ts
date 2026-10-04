export function firstCrate(list: string[]): string {
  return list[0];
}

export function lastCrate(list: string[]): string {
  return list[list.length - 1];
}

export function addCrate(list: string[], item: string): number {
  list.push(item);
  return list.length;
}
