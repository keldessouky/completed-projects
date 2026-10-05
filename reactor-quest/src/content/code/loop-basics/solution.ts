const crew = ["Ada", "Bo", "Cy"];

for (const name of crew) {
  console.log(name);
}
console.log(`Present: ${crew.length}`);

const weights = [12, 40, 7];
let total = 0;
for (const w of weights) {
  total = total + w;
}
console.log(`Total: ${total}`);
