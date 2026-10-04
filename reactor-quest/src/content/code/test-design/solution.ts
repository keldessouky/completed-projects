export type Case = { weight: number; express: boolean; expected: number };

export const cases: Case[] = [
  { weight: 10, express: false, expected: 25 },
  { weight: 10, express: true, expected: 50 },
  { weight: 49, express: false, expected: 103 },
  { weight: 50, express: false, expected: 94.5 },
  { weight: 60, express: true, expected: 225 },
  { weight: 0.5, express: false, expected: 6 },
];

export const throwingWeights: number[] = [0, -5];
