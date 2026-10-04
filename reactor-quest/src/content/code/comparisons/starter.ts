// A comparison asks a yes-or-no question. The answer is a *boolean*:
// either true or false.
//
//   ===  is equal to            !==  is not equal to
//   <    is less than           >    is greater than
//   <=   less than or equal     >=   greater than or equal
//
//   console.log(3 > 2);         // true
//   const isEmpty = 0 === 0;    // a variable can hold a boolean too

const fuel = 35;
const hull: string = "Kestrel"; // ": string" means hull holds text — any text

// Print the answer to each question, in this order:
// 1. Is fuel less than 50?
// 2. Is fuel exactly 35?
// 3. Is the hull NOT called "Swift"?
// 4. Is fuel at least 40?
