// FROM A BLANK FILE. Design the types, then the functions.
//
// Drones take three kinds of command. Export a type called Command for them,
// a discriminated union on a `kind` field:
//   kind "move"  — also has x and y (numbers)
//   kind "scan"  — nothing else
//   kind "say"   — also has text (a string)
//
// describe(command)       → "Move to 3,4"   "Scan"   'Say "hello"'
// countByKind(commands)   → how many of each kind: { move: 2, scan: 0, say: 1 }
//                           (every kind is always there, even with 0)
// lastOf(items)           → the last item of ANY array, or undefined if it's empty.
//                           Typed precisely: lastOf([1, 2]) has type number | undefined.
