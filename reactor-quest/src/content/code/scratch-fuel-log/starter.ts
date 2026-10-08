// FROM A BLANK FILE. This time you write the types too.
//
// Export an interface called Refuel: a ship name (string), the litres taken
// (number), and an optional note (string).
//
// totalFor(log, ship)   → the total litres that ship took (0 if none)
// describe(entry)       → entry is a Refuel, or null:
//                           null                                     → "No refuel"
//                           { ship: "Kite", litres: 40 }             → "Kite: 40 L"
//                           { ship: "Kite", litres: 40, note: "rush" } → "Kite: 40 L (rush)"
// biggest(log)          → the Refuel with the most litres, or null for an empty log
//                         (if two tie, the first one)
