// A *variable* is a named box that holds a value, so you can use it later.
//
//   const name = value;   a box you fill once and never refill
//   let name = value;     a box you can refill:   name = newValue;
//
// The station's power starts at 10, then the backup generator adds 25.
// Press Run first: the compiler refuses. Hover the red squiggle and read why.
// Then fix it, so the first line printed is:   Orrery 35

const station = "Orrery";
const power = 10;

power = power + 25;

console.log(station, power);

// Finally, make a variable called crew that holds the number 12,
// and print it on its own line.
