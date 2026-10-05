// A *loop* runs the same code once for every item in a list.
// A for...of loop looks like this:
//
//   for (const name of crew) {
//     console.log(name);      // runs once for each name, in order
//   }
//
// Inside the { }, `name` holds the current item: first "Ada", then "Bo", then "Cy".
//
// 1. The roll call below prints every name by hand. That breaks the moment
//    someone joins the crew. Replace the three console.log lines with ONE loop
//    that prints every name.
// 2. After the loop, print how many people answered, like this:
//      Present: 3
//    (You don't need to count: the list knows its own length.)
// 3. Finally, add up the crate weights with a loop and print:
//      Total: 59
//    Keep a running total in a variable: start it at 0, and add each weight to it.

const crew = ["Ada", "Bo", "Cy"];

console.log("Ada");
console.log("Bo");
console.log("Cy");

const weights = [12, 40, 7];
