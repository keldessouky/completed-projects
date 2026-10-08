export function rationsNeeded(crew: number, days: number): number {
  return crew * days * 3;
}

export function supplyReport(crew: number, days: number, stock: number): string {
  const needed = rationsNeeded(crew, days);
  if (stock >= needed) return "Enough rations";
  return `Short by ${needed - stock} rations`;
}
