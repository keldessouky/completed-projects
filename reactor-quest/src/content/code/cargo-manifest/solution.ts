export function totalMass(masses: number[]): number {
  let total = 0;
  for (const m of masses) total += m;
  return total;
}

export function heaviest(masses: number[]): [index: number, mass: number] {
  let index = -1;
  let mass = 0;
  masses.forEach((m, i) => {
    if (index === -1 || m > mass) {
      index = i;
      mass = m;
    }
  });
  return [index, mass];
}
