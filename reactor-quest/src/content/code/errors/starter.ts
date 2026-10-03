// When something goes wrong, code can *throw* an error. It stops the current
// function immediately and travels up until something *catches* it:
//
//   if (amount < 0) {
//     throw new Error("Amount can't be negative");
//   }
//
//   try {
//     risky();
//   } catch (error) {
//     console.log("That failed, but we carry on");
//   }

// 1. Turn a sensor reading like "42.5" into a number.
//    If it isn't a number, or it's negative, THROW an Error whose message is:
//      Invalid fuel reading: <the text>
//    (Number("abc") gives NaN; Number.isNaN(x) checks for it.)
export function parseFuel(text: string): number {
  return Number(text);
}

// 2. Like parseFuel, but never throws: bad readings give null instead.
export function safeParseFuel(text: string): number | null {
  return parseFuel(text);
}

// 3. Parse a batch. Keep the good numbers, and collect the bad texts.
//      parseBatch(["10", "oops", "5"]) → { ok: [10, 5], failed: ["oops"] }
export function parseBatch(texts: string[]): { ok: number[]; failed: string[] } {
  return { ok: [], failed: [] };
}
