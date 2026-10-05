// Floor 2 is all about lists. A list in code is called an *array*: values in
// order, between square brackets, separated by commas:
//
//   const crates = ["coolant", "fuses", "rations"];
//
// Each item has a position number, its *index*. Counting starts at 0, not 1:
//   crates[0] is "coolant", crates[1] is "fuses", crates[2] is "rations"
// crates.length is how many items there are: 3
// crates.push("tools") adds "tools" to the end of the list.
//
// The cargo lift's display prints the wrong things. Make it print, in order:
//   fuses        (the item at index 1)
//   3            (how many crates there are)
//   rations      (the last crate)
// Then add "tools" to the end of the list, and print the new length:
//   4
// Read everything from the array: don't type the answers in yourself.

const crates = ["coolant", "fuses", "rations"];

console.log("coolant");
console.log(0);
console.log(crates);
