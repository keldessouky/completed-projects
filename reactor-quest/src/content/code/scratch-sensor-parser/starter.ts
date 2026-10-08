// FROM A BLANK FILE. Readings arrive from outside the station as unknown data.
// Turn them into safe, typed values, and never throw.
//
// Export:
//   Result<T>   { ok: true; value: T }  or  { ok: false; error: string }
//   Reading     { sensor: string; value: number }
//
//   parseReading(input: unknown): Result<Reading>
//     not an object (or null, or an array)   → error "Not an object"
//     sensor missing, or not a string         → error "Missing sensor"
//     value not a number, or NaN              → error "Value must be a number"
//     otherwise                               → ok, holding ONLY sensor and value
//                                               (drop any other fields)
//
//   parseAll(inputs: unknown[])  → { readings: Reading[]; errors: string[] }
//     every good reading, and every error message, each in order
