// `if` runs a block of code only when its condition is true.
// `else if` tries another condition, and `else` catches everything left over.
//
//   if (score > 90) {
//     return "A";
//   } else if (score > 75) {
//     return "B";
//   } else {
//     return "C";
//   }

// 1. coreStatus: above 900 → "OVERHEAT", above 600 → "WARM", otherwise "STABLE".
export function coreStatus(temp: number): string {
  return "STABLE";
}

// 2. canLaunch: true when fuel is 20 or more, otherwise false.
//    Tip: a comparison already IS true or false, so you can return it directly.
export function canLaunch(fuel: number): boolean {
  return false;
}
