// Professionals don't just write code — they write the tests that prove it
// works. Good tests are chosen carefully: they probe the *edges*, where bugs live.
//
// Here is the spec for the station's shipping calculator:
//
//   shippingCost(weightKg, express)
//     - weight must be greater than 0, otherwise it THROWS
//     - cost is 5 credits plus 2 credits per kg
//     - shipments of 50 kg or more get 10% off   (50 itself counts!)
//     - express doubles the final cost
//
// You don't write shippingCost. You write the TEST CASES. The station runs your
// cases against the real calculator (they must all pass) and against several
// broken versions written by a careless intern. Every broken version must fail
// at least one of your cases.

export type Case = { weight: number; express: boolean; expected: number };

// Cases that should return a cost.
export const cases: Case[] = [
  { weight: 10, express: false, expected: 25 },
];

// Weights that should make shippingCost throw.
export const throwingWeights: number[] = [];
