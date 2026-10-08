// FROM A BLANK FILE. Just the spec: you choose the loops and methods.
//
// Each shift on the duty roster is an object like  { name: "Ada", hours: 42 }.
//
// Export a type called Shift for those objects (name: string, hours: number), and:
//
// totalHours(shifts)         → everyone's hours added up (0 for an empty list)
// overworked(shifts, limit)  → the NAMES of everyone working MORE than limit
//                              hours, in their original order
// busiest(shifts)            → the name of whoever works the most hours
//                              ("" for an empty list; if two tie, the first one)
