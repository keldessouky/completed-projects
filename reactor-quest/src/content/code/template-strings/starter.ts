// Joining lots of pieces with + gets messy. A *template string* uses
// backticks ` (top-left of your keyboard) instead of quotes, and anything
// inside ${ } is worked out and dropped into the text:
//
//   const name = "Ada";
//   console.log(`Hello, ${name}!`);        // Hello, Ada!
//   console.log(`2 + 2 is ${2 + 2}`);      // 2 + 2 is 4

const pilot = "Nova";
const bay = 7;
const crew = 3;

// 1. Using the three variables above (not by typing the values!), print:
//      Pilot Nova is docking at bay 7 with 3 crew.
console.log("Pilot Nova is docking at bay 7 with 3 crew.");

// 2. Two more crew members board. Print the new total, worked out with ${ }:
//      Crew aboard: 5
