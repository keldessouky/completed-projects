import type { Deck } from '../game/types';
import { CheckFailure } from '../engine/runtime';
import { blankPage, codeFiles, fnOf, line, mustNotUse, mustUse } from './helpers';

const CREW = [
  { name: 'Ada', role: 'engineer', age: 34, onDuty: true },
  { name: 'Bo', role: 'pilot', age: 28, onDuty: false },
  { name: 'Cy', role: 'medic', age: 41, onDuty: true },
  { name: 'Di', role: 'pilot', age: 25, onDuty: true },
];

const ITEMS = [
  { name: 'Rations', category: 'food', qty: 30, price: 2 },
  { name: 'Coolant', category: 'fluids', qty: 4, price: 18 },
  { name: 'Fuses', category: 'tools', qty: 3, price: 5 },
  { name: 'Water', category: 'food', qty: 10, price: 1 },
  { name: 'Wrench', category: 'tools', qty: 4, price: 12 },
];

export const floor2: Deck = {
  id: 'supply',
  name: 'Supply Lines',
  subtitle: 'Lists, loops and objects',
  outcome: 'You can store collections of data and process them with loops and array methods.',
  hue: 165,
  levels: [
    {
      kind: 'code',
      id: 'lists',
      title: 'Lists',
      system: 'Cargo Lift',
      skills: ['arrays'],
      ...codeFiles('lists', 'ts'),
      brief: `**ARIA:** Floor 2: Supply Lines. Down here, nothing comes in ones. Crates, crew, sensors, invoices. Everything is a *list*.

The cargo lift is holding a perfectly good list of crates. Its display just can't read it. It keeps announcing the wrong crate with great confidence.`,
      lesson: `## Arrays

A list of values in code is called an **array**. Write the values between square brackets, separated by commas:

\`\`\`ts
const crates = ["coolant", "fuses", "rations"];
const weights = [12, 40, 7];
\`\`\`

## Reading one item

Every item has a numbered position called its **index**. Counting starts at **0**, not 1:

\`\`\`ts
crates[0]   // "coolant"
crates[1]   // "fuses"
crates[2]   // "rations"
\`\`\`

Starting at 0 feels odd for about a week. Then it feels normal forever.

## How many?

\`.length\` is how many items the array holds:

\`\`\`ts
crates.length   // 3
\`\`\`

Since the first index is 0, the **last** index is always one less than the length. This works for a list of any size:

\`\`\`ts
crates[crates.length - 1]   // "rations"
\`\`\`

## Adding an item

\`.push(item)\` adds an item to the end. The array grows, and its length goes up by one:

\`\`\`ts
crates.push("tools");
crates.length   // 4
\`\`\``,
      hints: [
        'The item at index 1 is `crates[1]`. Put that inside `console.log( )` instead of the word in quotes.',
        '`crates.length` is the count. The last index is one less: `crates[crates.length - 1]`.',
        'Add `crates.push("tools");` on its own line, then `console.log(crates.length);` after it.',
      ],
      checks: [
        { label: 'Line 1 prints the crate at index 1 ("fuses")', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('fuses') },
        { label: 'Line 2 prints how many crates there are (3)', run: ({ logs, expect }) => expect(line(logs, 1)).toBe('3') },
        { label: 'Line 3 prints the last crate ("rations")', run: ({ logs, expect }) => expect(line(logs, 2)).toBe('rations') },
        { label: 'After pushing "tools", line 4 prints the new length (4)', run: ({ logs, expect }) => expect(line(logs, 3)).toBe('4') },
        { label: 'Reads the answers from the array', run: ({ source }) => {
          mustNotUse(source, /console\.log\(\s*["'`]/, 'Print values read from the array, like crates[1], not words typed in quotes.');
          mustNotUse(source, /console\.log\(\s*\d/, 'Let the array count itself: crates.length, not a number you typed.');
          mustUse(source, /crates\s*\.\s*push\s*\(/, 'Add "tools" with crates.push("tools").');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'arrays',
      title: 'Arrays',
      system: 'Cargo Racks',
      skills: ['arrays'],
      ...codeFiles('arrays', 'ts'),
      brief: `**ARIA:** The cargo racks have forgotten how to read their lists. This time, wrap the reading in functions, so the racks can ask about *any* list: three crates or three thousand.`,
      lesson: `## Arrays

An **array** is an ordered list of values, written in square brackets:

\`\`\`ts
const crates = ["coolant", "fuses", "rations"];
const weights = [12, 40, 7];
\`\`\`

## Indexes start at 0

Each item has a numbered position called its **index**. The first item is at index **0**:

\`\`\`ts
crates[0]   // "coolant"
crates[1]   // "fuses"
crates[2]   // "rations"
\`\`\`

## Length, and the last item

\`.length\` is how many items there are. Since counting starts at 0, the last index is always \`length - 1\`:

\`\`\`ts
crates.length                  // 3
crates[crates.length - 1]      // "rations": works for any length
\`\`\`

## Adding items

\`.push(item)\` adds to the end:

\`\`\`ts
crates.push("tools");    // crates is now 4 items long
\`\`\`

(\`const\` means the variable always points at the *same* array. The array itself can still grow.)

## Types for lists

\`string[]\` is "a list of strings", \`number[]\` is "a list of numbers". The compiler then stops you putting a number in a list of strings.`,
      hints: [
        'The first item is at index 0: `return list[0];`',
        'The last index is one less than the length: `return list[list.length - 1];`',
        'In `addCrate`: first `list.push(item);`, then `return list.length;`',
      ],
      checks: [
        { label: 'firstCrate', run: ({ mod, expect }) => expect(fnOf(mod, 'firstCrate')(['coolant', 'fuses', 'rations'])).toBe('coolant') },
        { label: 'lastCrate works for any length', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'lastCrate')(['coolant', 'fuses', 'rations'])).toBe('rations');
          expect(fnOf(mod, 'lastCrate')(['solo'])).toBe('solo');
          expect(fnOf(mod, 'lastCrate')(['a', 'b', 'c', 'd', 'e'])).toBe('e');
        } },
        { label: 'addCrate adds to the end and returns the new length', run: ({ mod, expect }) => {
          const list = ['coolant', 'fuses'];
          expect(fnOf(mod, 'addCrate')(list, 'tools')).toBe(3);
          expect(list).toEqual(['coolant', 'fuses', 'tools']);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'loop-basics',
      title: 'Repeat After Me',
      system: 'Roll Call',
      skills: ['iteration', 'arrays'],
      ...codeFiles('loop-basics', 'ts'),
      brief: `**ARIA:** Roll call. Every shift, the station prints the name of everyone aboard. The last engineer wrote one line per crew member. When someone new arrived, they were simply never mentioned again. She is still upset about it.

**THE FEED:** *Viewers, our engineer is about to discover loops. Experts agree this is the moment programming stops being typing and starts being magic.*`,
      lesson: `## Doing something for every item

A **loop** runs the same code again and again. A \`for…of\` loop runs once **for each item** in an array, in order:

\`\`\`ts
const crew = ["Ada", "Bo", "Cy"];

for (const name of crew) {
  console.log(name);
}
// Ada
// Bo
// Cy
\`\`\`

Read it as: *"for each name in crew, do what's inside the braces."* On the first run \`name\` is \`"Ada"\`, then \`"Bo"\`, then \`"Cy"\`. Then the loop ends and the program carries on below it.

Add a fourth name to the array and the loop prints it too. You never touch the loop again.

## A running total

To add up a list, keep a variable **outside** the loop and add each item to it **inside**:

\`\`\`ts
let total = 0;               // let: this box gets refilled
for (const w of [4, 5, 6]) {
  total = total + w;         // 0+4, then 4+5, then 9+6
}
console.log(total);          // 15
\`\`\`

\`total = total + w\` means "work out total + w, then store it back in total". There's a shortcut that means exactly the same: \`total += w\`.`,
      hints: [
        'Replace the three `console.log` lines with: `for (const name of crew) { console.log(name); }`',
        'After the loop\'s closing brace: ``console.log(`Present: ${crew.length}`);``',
        'Make `let total = 0;`, loop with `for (const w of weights) { total = total + w; }`, then ``console.log(`Total: ${total}`);``',
      ],
      checks: [
        { label: 'Prints every name, in order', run: ({ logs, expect }) => {
          expect([line(logs, 0), line(logs, 1), line(logs, 2)]).toEqual(['Ada', 'Bo', 'Cy']);
        } },
        { label: 'Then prints "Present: 3"', run: ({ logs, expect }) => expect(line(logs, 3)).toBe('Present: 3') },
        { label: 'Then prints "Total: 59"', run: ({ logs, expect }) => expect(line(logs, 4)).toBe('Total: 59') },
        { label: 'Uses for…of loops, not one line per name', run: ({ source }) => {
          mustUse(source, /for\s*\(\s*(const|let)\s+\w+\s+of\b/, 'Walk through the list with a for…of loop.');
          mustNotUse(source, /console\.log\(\s*["'`](Ada|Bo|Cy)/, 'Let the loop print the names. Delete the lines that print them by hand.');
          mustNotUse(source, /\b59\b|12\s*\+\s*40/, 'Let a loop add up the weights, instead of working out 59 yourself.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'loops',
      title: 'Loops',
      system: 'Weighbridge',
      skills: ['iteration', 'arrays'],
      ...codeFiles('loops', 'ts'),
      brief: `**ARIA:** The weighbridge weighs crates one at a time, and it has to add them up. The last engineer did this by writing one line per crate. There are four thousand crates. The file is still loading.`,
      lesson: `## for…of loops

A **loop** runs the same code many times. A \`for…of\` loop runs once **for each item** in an array, with the item in a variable:

\`\`\`ts
const names = ["Ada", "Bo", "Cy"];
for (const name of names) {
  console.log(name);
}
// Ada
// Bo
// Cy
\`\`\`

## The accumulator pattern

To total things up: make a variable **before** the loop, update it **inside**, use it **after**:

\`\`\`ts
let total = 0;
for (const n of [4, 5, 6]) {
  total = total + n;      // or the shortcut: total += n;
}
// total is 15
\`\`\`

## Counting with a condition

Put an \`if\` inside the loop:

\`\`\`ts
let count = 0;
for (const n of numbers) {
  if (n > 10) {
    count++;              // ++ adds 1
  }
}
\`\`\`

## Keeping the best so far

Remember the best item seen so far, and replace it when you find a better one:

\`\`\`ts
let biggest = numbers[0];
for (const n of numbers) {
  if (n > biggest) biggest = n;
}
\`\`\``,
      hints: [
        '`totalWeight`: start `let total = 0;`, loop `for (const w of weights) { total += w; }`, then `return total;`.',
        '`countHeavy`: same shape, but only `count++` inside `if (w > limit)`.',
        '`longestName`: start with `let longest = "";` and replace it when `name.length > longest.length`. Using `>` (not `>=`) keeps the first of two equal names.',
      ],
      checks: [
        { label: 'totalWeight adds everything', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'totalWeight')([12, 40, 7])).toBe(59);
          expect(fnOf(mod, 'totalWeight')([])).toBe(0);
        } },
        { label: 'countHeavy counts weights over the limit', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'countHeavy')([12, 40, 7, 25], 20)).toBe(2);
          expect(fnOf(mod, 'countHeavy')([20, 20], 20)).toBe(0);
        } },
        { label: 'longestName', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'longestName')(['Bo', 'Ada', 'Cy'])).toBe('Ada');
          expect(fnOf(mod, 'longestName')(['Ada', 'Bob', 'Cy'])).toBe('Ada');
          expect(fnOf(mod, 'longestName')([])).toBe('');
        } },
        { label: 'Uses for…of loops', run: ({ source }) => mustUse(source, /for\s*\(\s*(const|let)\s+\w+\s+of\b/, 'Walk through the list with a for…of loop.') },
      ],
    },
    {
      kind: 'code',
      id: 'for-while',
      title: 'Counting Loops',
      system: 'Launch Sequencer',
      skills: ['iteration'],
      ...codeFiles('for-while', 'ts'),
      brief: `**ARIA:** The launch sequencer counts down, counts fuel burns, and counts up the even-numbered bays. The previous version counted to infinity. That took a while.

(This station has a safety system now: a loop that runs too long gets stopped, and you get a message instead of a frozen screen.)`,
      lesson: `## The classic for loop

When you need to count, rather than walk through a list, use a \`for\` loop with three parts:

\`\`\`ts
for (let i = 1; i <= 3; i++) {
  console.log(i);    // 1, 2, 3
}
\`\`\`

1. **Start**: \`let i = 1\` runs once, before anything else.
2. **Keep going while**: \`i <= 3\` is checked before every round.
3. **Step**: \`i++\` runs after every round. Counting down? Use \`i--\`. Steps of 2? \`i += 2\`.

## Building an array in a loop

\`\`\`ts
const squares: number[] = [];    // an empty list of numbers
for (let i = 1; i <= 3; i++) {
  squares.push(i * i);
}
// squares is [1, 4, 9]
\`\`\`

## while loops

A \`while\` loop repeats as long as its condition is true. It's useful when you don't know in advance how many rounds you'll need:

\`\`\`ts
let fuel = 10;
let burns = 0;
while (fuel > 0) {
  fuel -= 4;        // shortcut for fuel = fuel - 4
  burns++;
}
// burns is 3
\`\`\`

**Infinite loops.** If the condition never becomes false (say you forget \`fuel -= 4\`), the loop runs forever. Every programmer does this eventually. Here the station stops it for you.`,
      hints: [
        '`countdown`: `const result: number[] = [];` then `for (let i = from; i >= 1; i--) { result.push(i); }` then return it.',
        '`evens`: start at 2 and step by 2: `for (let n = 2; n <= limit; n += 2)`.',
        '`burnsUntilEmpty`: `let burns = 0; while (fuel > 0) { fuel -= burn; burns++; } return burns;`',
      ],
      checks: [
        { label: 'countdown(3) is [3, 2, 1]', run: ({ mod, expect }) => expect(fnOf(mod, 'countdown')(3)).toEqual([3, 2, 1]) },
        { label: 'countdown(1) is [1], countdown(0) is []', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'countdown')(1)).toEqual([1]);
          expect(fnOf(mod, 'countdown')(0)).toEqual([]);
        } },
        { label: 'evens(7) is [2, 4, 6], evens(8) includes 8', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'evens')(7)).toEqual([2, 4, 6]);
          expect(fnOf(mod, 'evens')(8)).toEqual([2, 4, 6, 8]);
        } },
        { label: 'burnsUntilEmpty', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'burnsUntilEmpty')(10, 4)).toBe(3);
          expect(fnOf(mod, 'burnsUntilEmpty')(12, 4)).toBe(3);
          expect(fnOf(mod, 'burnsUntilEmpty')(0, 4)).toBe(0);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'objects',
      title: 'Objects',
      system: 'Ship Registry',
      skills: ['objects'],
      ...codeFiles('objects', 'ts'),
      brief: `**ARIA:** The ship registry keeps each ship's details in an *object*. Name, crew, docked or not, all together in one bundle. Right now it describes every ship as just its name, and it fuels ships to 140%. The ships have complained. Loudly. From space.`,
      lesson: `## Objects

An **object** bundles related values together, each under a name. The values are called **properties**:

\`\`\`ts
const ship = { name: "Kite", crew: 4, docked: true };
\`\`\`

Read a property with a dot, and change it the same way:

\`\`\`ts
ship.name        // "Kite"
ship.crew = 5;   // now 5
\`\`\`

## Object types

An object's type lists each property and its type:

\`\`\`ts
function welcome(ship: { name: string; crew: number }): string {
  return \`Welcome, \${ship.name}!\`;
}
\`\`\`

## Making objects

Return a new object literal:

\`\`\`ts
function makePoint(x: number): { x: number; y: number } {
  return { x: x, y: 0 };    // or just { x, y: 0 } when the names match
}
\`\`\`

## The ternary: a one-line if/else

\`condition ? valueIfTrue : valueIfFalse\` picks one of two values:

\`\`\`ts
const status = ship.docked ? "docked" : "in flight";
\`\`\`

Use it for choosing a *value*. For running *code*, use \`if\`.`,
      hints: [
        '`describeShip`: pick the status with a ternary: `const status = ship.docked ? "docked" : "in flight";`, then return a template string.',
        '`newShip`: `return { name: name, crew: 0, docked: true };`',
        '`refuel`: update `ship.fuel = ship.fuel + amount;`, then `if (ship.fuel > 100) { ship.fuel = 100; }`, then return `ship.fuel`.',
      ],
      checks: [
        { label: 'Describes a docked ship', run: ({ mod, expect }) => expect(fnOf(mod, 'describeShip')({ name: 'Kite', crew: 4, docked: true })).toBe('Kite (4 crew, docked)') },
        { label: 'Describes a ship in flight', run: ({ mod, expect }) => expect(fnOf(mod, 'describeShip')({ name: 'Swift', crew: 2, docked: false })).toBe('Swift (2 crew, in flight)') },
        { label: 'newShip makes a fresh ship', run: ({ mod, expect }) => expect(fnOf(mod, 'newShip')('Swift')).toEqual({ name: 'Swift', crew: 0, docked: true }) },
        { label: 'refuel adds fuel and updates the ship', run: ({ mod, expect }) => {
          const ship = { fuel: 40 };
          expect(fnOf(mod, 'refuel')(ship, 25)).toBe(65);
          expect(ship.fuel).toBe(65);
        } },
        { label: 'refuel never goes above 100', run: ({ mod, expect }) => {
          const ship = { fuel: 90 };
          expect(fnOf(mod, 'refuel')(ship, 25)).toBe(100);
          expect(ship.fuel).toBe(100);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'crew-search',
      title: 'Lists of Objects',
      system: 'Crew Manifest',
      skills: ['objects', 'iteration'],
      ...codeFiles('crew-search', 'ts'),
      brief: `**ARIA:** Here's what real data looks like: a list of objects. The crew manifest needs three answers: who's the pilot, who's on duty, and how old is everyone on average. (The crew asked me to stop answering that last one at parties.)`,
      lesson: `## Lists of objects

Most real data is an array of objects:

\`\`\`ts
const crew = [
  { name: "Ada", role: "engineer", age: 34 },
  { name: "Bo",  role: "pilot",    age: 28 },
];
\`\`\`

Loop through them and read each one's properties:

\`\`\`ts
for (const member of crew) {
  console.log(member.name);
}
\`\`\`

## Naming a shape with \`type\`

Writing \`{ name: string; role: string; age: number }\` everywhere gets old. A **type alias** gives the shape a name:

\`\`\`ts
type CrewMember = { name: string; role: string; age: number };
function oldest(crew: CrewMember[]): string { … }
\`\`\`

\`CrewMember[]\` means "a list of CrewMember objects".

## Returning early from a loop

\`return\` inside a loop ends the whole function straight away. That makes it perfect for "find the first one":

\`\`\`ts
for (const member of crew) {
  if (member.role === "medic") {
    return member.name;      // found it, stop here
  }
}
return "none";               // only reached if no medic was found
\`\`\`

## Watch out for empty lists

Dividing by \`crew.length\` when the list is empty gives \`NaN\` ("Not a Number"). Check for an empty list first.`,
      hints: [
        '`findPilot`: loop with `for (const member of crew)`, and `return member.name` as soon as `member.role === "pilot"`. After the loop, `return "none"`.',
        '`onDutyNames`: start with `const names: string[] = [];` and `names.push(member.name)` when `member.onDuty` is true.',
        '`averageAge`: if `crew.length === 0` return 0. Otherwise add up `member.age` in a loop and divide by `crew.length`.',
      ],
      checks: [
        { label: 'findPilot finds the first pilot', run: ({ mod, expect }) => expect(fnOf(mod, 'findPilot')(CREW)).toBe('Bo') },
        { label: 'findPilot says "none" when there is no pilot', run: ({ mod, expect }) => expect(fnOf(mod, 'findPilot')(CREW.filter((c) => c.role !== 'pilot'))).toBe('none') },
        { label: 'onDutyNames', run: ({ mod, expect }) => expect(fnOf(mod, 'onDutyNames')(CREW)).toEqual(['Ada', 'Cy', 'Di']) },
        { label: 'averageAge', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'averageAge')(CREW)).toBe(32);
          expect(fnOf(mod, 'averageAge')([])).toBe(0);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'map-method',
      title: 'Transform with map',
      system: 'Label Printer',
      skills: ['iteration', 'functions'],
      ...codeFiles('map-method', 'ts'),
      brief: `**ARIA:** Loops work. But professional code rarely writes "make an empty list, loop, push" by hand. Arrays come with **methods** that do the looping for you, in one readable line. The label printer is your first chance to use one.`,
      lesson: `## Short functions: arrows

Here's a shorter way to write a function, called an **arrow function**:

\`\`\`ts
(n) => n * 10
\`\`\`

Read it as "take \`n\`, give back \`n * 10\`". It's the same as:

\`\`\`ts
function (n) { return n * 10; }
\`\`\`

## .map()

\`.map(fn)\` calls your function on **every item** and collects the results into a **new array** of the same length:

\`\`\`ts
[1, 2, 3].map((n) => n * 10);           // [10, 20, 30]
["ada", "bo"].map((s) => s.toUpperCase()); // ["ADA", "BO"]
crew.map((m) => m.name);                 // just the names
\`\`\`

The original array isn't changed. You get a new one.

## Loop vs map

\`\`\`ts
// The loop way
const names: string[] = [];
for (const m of crew) names.push(m.name);

// The map way: same result
const names = crew.map((m) => m.name);
\`\`\`

Same result, but \`map\` says *what* you want ("the names") instead of *how* to collect them. That's easier to read, and harder to get wrong.`,
      hints: [
        '`shout`: `return names.map((name) => name.toUpperCase());`',
        '`withTax`: `return prices.map((price) => price * 1.2);`',
        '`labels`: map each member to a template string: ``crew.map((m) => `${m.name} (${m.role})`)``',
      ],
      checks: [
        { label: 'shout', run: ({ mod, expect }) => expect(fnOf(mod, 'shout')(['ada', 'Bo'])).toEqual(['ADA', 'BO']) },
        { label: 'withTax', run: ({ mod, expect }) => expect(fnOf(mod, 'withTax')([10, 50])).toEqual([12, 60]) },
        { label: 'labels', run: ({ mod, expect }) => expect(fnOf(mod, 'labels')([{ name: 'Ada', role: 'pilot' }, { name: 'Cy', role: 'medic' }])).toEqual(['Ada (pilot)', 'Cy (medic)']) },
        { label: 'The original array is untouched', run: ({ mod, expect }) => {
          const names = ['ada'];
          fnOf(mod, 'shout')(names);
          expect(names).toEqual(['ada']);
        } },
        { label: 'Uses .map() instead of loops', run: ({ source }) => {
          mustUse(source, /\.map\(/, 'Use .map() to transform the arrays.');
          mustNotUse(source, /\bfor\s*\(|\bwhile\s*\(/, 'No loops this time. .map() does the looping for you.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'filter-method',
      title: 'Select with filter',
      system: 'Sensor Filter',
      skills: ['iteration'],
      ...codeFiles('filter-method', 'ts'),
      brief: `**ARIA:** The sensor filter is supposed to pass along the interesting readings. Right now it passes along everything, which is how the bridge ended up with eleven thousand alerts about a slightly warm toaster.`,
      lesson: `## .filter()

\`.filter(fn)\` keeps only the items your function returns \`true\` for, in a **new array**:

\`\`\`ts
[5, 12, 8, 20].filter((n) => n > 10);    // [12, 20]
crew.filter((m) => m.onDuty);             // only the crew on duty
\`\`\`

## Chaining

Each array method returns a new array, so you can call another method on the result straight away. That's called **chaining**:

\`\`\`ts
crew
  .filter((m) => m.onDuty)       // the people on duty…
  .map((m) => m.name);           // …just their names
\`\`\`

Read it top to bottom, like a recipe: *take the crew, keep the ones on duty, take their names*. Splitting a chain over several lines like this is normal.

## The type of what's left

TypeScript knows that \`filter\` gives back the same kind of array: filtering a \`Sensor[]\` gives a \`Sensor[]\`. After \`.map((s) => s.id)\`, it's a \`string[]\`. Hover over the variables to see.`,
      hints: [
        '`onlineSensors`: `return sensors.filter((s) => s.online);`',
        '`affordable`: "at or below" is `<=`: `prices.filter((p) => p <= budget)`.',
        '`overheatingIds`: `sensors.filter((s) => s.online && s.reading > 900).map((s) => s.id)`',
      ],
      checks: [
        { label: 'onlineSensors', run: ({ mod, expect }) => expect(fnOf(mod, 'onlineSensors')([{ id: 'a', online: true, reading: 1 }, { id: 'b', online: false, reading: 2 }]).map((s: { id: string }) => s.id)).toEqual(['a']) },
        { label: 'affordable includes prices equal to the budget', run: ({ mod, expect }) => expect(fnOf(mod, 'affordable')([5, 20, 12, 30], 12)).toEqual([5, 12]) },
        { label: 'overheatingIds: online AND above 900', run: ({ mod, expect }) => expect(fnOf(mod, 'overheatingIds')([
          { id: 'core', online: true, reading: 950 },
          { id: 'vent', online: false, reading: 990 },
          { id: 'pump', online: true, reading: 400 },
          { id: 'coil', online: true, reading: 901 },
        ])).toEqual(['core', 'coil']) },
        { label: 'Uses .filter()', run: ({ source }) => mustUse(source, /\.filter\(/, 'Use .filter() to select items.') },
      ],
    },
    {
      kind: 'code',
      id: 'find-some',
      title: 'find, some, every',
      system: 'Door Control',
      skills: ['iteration', 'arrays'],
      ...codeFiles('find-some', 'ts'),
      brief: `**ARIA:** Door control asks questions about lists all day. Where's door B7? Is *any* reading critical? Are *all* doors sealed? It used to answer by checking every door by hand. It now has a union rep.`,
      lesson: `## Asking questions of an array

| Method | Gives back | Example |
|---|---|---|
| \`.find(fn)\` | the **first** item that passes, or \`undefined\` | \`crew.find((m) => m.role === "medic")\` |
| \`.some(fn)\` | \`true\` if **at least one** passes | \`readings.some((r) => r > 900)\` |
| \`.every(fn)\` | \`true\` if **all** pass | \`doors.every((d) => d.sealed)\` |
| \`.includes(x)\` | \`true\` if \`x\` is in the array | \`roles.includes("pilot")\` |

They stop as soon as they know the answer. \`some\` stops at the first match, \`every\` at the first failure.

## undefined

\`.find\` gives back \`undefined\` when nothing matches. \`undefined\` is JavaScript's value for "nothing here". That's why the return type is \`Door | undefined\`: either a Door, or nothing. The \`|\` means "or". You'll learn much more about it on Floor 4.

## An odd fact

\`[].every(...)\` is \`true\`. "Every door in an empty list is sealed" is technically true, since there's no unsealed door to prove it wrong. Logicians love this. Nobody else does.`,
      hints: [
        '`findDoor`: `return doors.find((d) => d.id === id);`',
        '`anyCritical` uses `.some`, `allSealed` uses `.every`.',
        '`isCertified`: `return ROLES.includes(role);`',
      ],
      checks: [
        { label: 'findDoor finds by id, or gives undefined', run: ({ mod, expect }) => {
          const doors = [{ id: 'A1', sealed: true }, { id: 'B7', sealed: false }];
          expect(fnOf(mod, 'findDoor')(doors, 'B7')).toEqual({ id: 'B7', sealed: false });
          expect(fnOf(mod, 'findDoor')(doors, 'Z9')).toBe(undefined);
        } },
        { label: 'anyCritical', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'anyCritical')([300, 950, 20])).toBe(true);
          expect(fnOf(mod, 'anyCritical')([300, 900])).toBe(false);
        } },
        { label: 'allSealed', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'allSealed')([{ id: 'A', sealed: true }, { id: 'B', sealed: true }])).toBe(true);
          expect(fnOf(mod, 'allSealed')([{ id: 'A', sealed: true }, { id: 'B', sealed: false }])).toBe(false);
        } },
        { label: 'isCertified', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'isCertified')('medic')).toBe(true);
          expect(fnOf(mod, 'isCertified')('chef')).toBe(false);
        } },
        { label: 'Uses find, some, every and includes', run: ({ source }) => {
          for (const m of ['find', 'some', 'every', 'includes']) mustUse(source, new RegExp(`\\.${m}\\(`), `Use .${m}() for this one.`);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'reduce-method',
      title: 'Summarize with reduce',
      system: 'Ledger Core',
      skills: ['iteration'],
      ...codeFiles('reduce-method', 'ts'),
      brief: `**ARIA:** The ledger core needs single answers from long lists: one total, one maximum, one tally. \`.reduce()\` is the most powerful array method, and the most feared. It's really just the accumulator loop you already know, wearing a fancy hat.`,
      lesson: `## .reduce()

\`.reduce(fn, start)\` boils a whole array down to **one value**. It's the accumulator pattern from the loops level, packed into a method:

\`\`\`ts
// The loop way
let total = 0;
for (const n of [4, 5, 6]) total = total + n;

// The reduce way
const total = [4, 5, 6].reduce((acc, n) => acc + n, 0);
\`\`\`

- \`0\` is the **starting value**, like \`let total = 0\`.
- Your function gets the **running result so far** (\`acc\`, short for accumulator) and the **next item**, and returns the **new running result**.

Step by step: \`acc\` starts at 0 → 0+4 = **4** → 4+5 = **9** → 9+6 = **15**.

## Reducing to an object

The starting value can be an empty object, which you fill in as you go. That's how you tally things up:

\`\`\`ts
const tally = ["a", "b", "a"].reduce((counts: Record<string, number>, letter) => {
  counts[letter] = (counts[letter] || 0) + 1;
  return counts;
}, {});
// { a: 2, b: 1 }
\`\`\`

- \`Record<string, number>\` is the type of "an object whose keys are strings and whose values are numbers". It goes on \`counts\`, so TypeScript knows what the \`{}\` will become.
- \`counts[letter]\` reads or sets a property whose name is in a variable.
- \`(counts[letter] || 0)\`: if there's no count yet (\`undefined\`), use 0.
- Don't forget \`return counts;\`. The function must hand back the running result every time.`,
      hints: [
        '`sum`: `return numbers.reduce((acc, n) => acc + n, 0);`',
        '`largest`: start at `-Infinity` (smaller than every number), and keep the bigger one each time: `(acc, n) => Math.max(acc, n)`.',
        '`countByRole`: copy the tally pattern from the lesson, using `member.role` as the key: `counts[member.role] = (counts[member.role] || 0) + 1;`.',
      ],
      checks: [
        { label: 'sum', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'sum')([4, 5, 6])).toBe(15);
          expect(fnOf(mod, 'sum')([])).toBe(0);
        } },
        { label: 'largest, even with negative numbers', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'largest')([3, 41, 7])).toBe(41);
          expect(fnOf(mod, 'largest')([-8, -3, -12])).toBe(-3);
          expect(fnOf(mod, 'largest')([])).toBe(-Infinity);
        } },
        { label: 'countByRole', run: ({ mod, expect }) => expect(fnOf(mod, 'countByRole')(CREW)).toEqual({ engineer: 1, pilot: 2, medic: 1 }) },
        { label: 'Uses .reduce()', run: ({ source }) => {
          const n = (source.match(/\.reduce\(/g) ?? []).length;
          if (n < 3) throw new CheckFailure('Use .reduce() in all three functions.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'scratch-rota',
      title: 'From Scratch: Shift Rota',
      system: 'Duty Roster',
      skills: ['arrays', 'iteration', 'objects'],
      ...codeFiles('scratch-rota', 'ts'),
      brief: `**ARIA:** The duty roster has been kept on the back of a ration crate since the outage. Nobody knows who has worked too long, and two crew members have started a small war over who works hardest. Write the roster's code from nothing, and settle it.`,
      lesson: blankPage(`- **Types for objects**: \`type Shift = { name: string; hours: number };\` and lists of them: \`Shift[]\`.
- **Loops and accumulators**: \`let total = 0; for (const s of shifts) total += s.hours;\`
- **Array methods**: \`filter\` keeps some items, \`map\` transforms them, \`reduce\` boils a list down to one value.
- **Keeping the best so far**: a variable that a loop replaces whenever it finds something better.`),
      hints: [
        'Plan: one `export type` and three `export function`s, each taking `shifts: Shift[]`.',
        '`overworked` is a `filter` (who is over the limit) followed by a `map` (just their names). `totalHours` can be a loop or a `reduce`.',
        'For `busiest`, keep the best shift so far (start with none). Replace it only when `s.hours > best.hours`, so the first of a tie wins. Return `""` if there was none.',
      ],
      typeChecks: [
        { label: 'Shift describes a name and hours', code: `import type { Shift } from './solution';\nconst s: Shift = { name: 'Ada', hours: 40 };\n// @ts-expect-error\nconst missing: Shift = { name: 'Bo' };\n// @ts-expect-error\nconst wrong: Shift = { name: 'Cy', hours: '40' };` },
      ],
      checks: [
        { label: 'totalHours adds everyone up', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'totalHours')([{ name: 'Ada', hours: 42 }, { name: 'Bo', hours: 30 }])).toBe(72);
          expect(fnOf(mod, 'totalHours')([])).toBe(0);
        } },
        { label: 'overworked lists names over the limit, in order', run: ({ mod, expect }) => {
          const shifts = [{ name: 'Ada', hours: 50 }, { name: 'Bo', hours: 40 }, { name: 'Cy', hours: 41 }];
          expect(fnOf(mod, 'overworked')(shifts, 40)).toEqual(['Ada', 'Cy']);
          expect(fnOf(mod, 'overworked')(shifts, 60)).toEqual([]);
        } },
        { label: 'busiest finds who works most', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'busiest')([{ name: 'Ada', hours: 30 }, { name: 'Bo', hours: 55 }, { name: 'Cy', hours: 41 }])).toBe('Bo');
        } },
        { label: 'busiest: the first of a tie, and "" for nobody', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'busiest')([{ name: 'Ada', hours: 50 }, { name: 'Bo', hours: 50 }])).toBe('Ada');
          expect(fnOf(mod, 'busiest')([])).toBe('');
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-collections',
      title: 'Predict the Output',
      system: 'Logistics Terminal',
      skills: ['arrays', 'iteration'],
      brief: `**ARIA:** Quick calibration. Read each snippet and predict what comes out, the way the computer would.`,
      lesson: `## Arrays and loops: the essentials

- Indexes start at **0**. The last index is \`length - 1\`.
- \`map\` → same length, transformed. \`filter\` → shorter (or equal), same items. \`reduce\` → one value.
- \`find\` → one item or \`undefined\`. \`some\`/\`every\`/\`includes\` → a boolean.
- Methods don't change the original array; \`push\` does.`,
      questions: [
        {
          prompt: 'What does this print?',
          code: `const bays = ["A", "B", "C", "D"];\nconsole.log(bays[1] + bays[bays.length - 1]);`,
          options: ['AD', 'BD', 'BC', 'AC'],
          answer: 1,
          explain: '`bays[1]` is the *second* item, "B". The last item is at `length - 1` = 3, which is "D".',
        },
        {
          prompt: 'What is `result`?',
          code: `const result = [1, 2, 3, 4]\n  .filter((n) => n % 2 === 0)\n  .map((n) => n * 10);`,
          options: ['[10, 20, 30, 40]', '[20, 40]', '[10, 30]', '60'],
          answer: 1,
          explain: '`filter` keeps the even numbers [2, 4], then `map` multiplies each by 10.',
        },
        {
          prompt: 'How many times does this loop print?',
          code: `for (let i = 0; i < 3; i++) {\n  console.log(i);\n}`,
          options: ['2', '3', '4', 'Forever'],
          answer: 1,
          explain: 'It prints 0, 1 and 2. When `i` reaches 3, `i < 3` is false and the loop stops. Starting from 0 and using `<` is the most common way to loop "n times".',
        },
        {
          prompt: 'What is `found`?',
          code: `const found = [4, 9, 12, 15].find((n) => n > 10);`,
          options: ['12', '[12, 15]', 'true', '15'],
          answer: 0,
          explain: '`find` gives back the **first** item that passes, just one item. `filter` would give [12, 15].',
        },
        {
          prompt: 'What is `total`?',
          code: `const total = [2, 3, 4].reduce((acc, n) => acc * n, 1);`,
          options: ['9', '24', '10', '0'],
          answer: 1,
          explain: 'It starts at 1, then 1×2 = 2, 2×3 = 6, 6×4 = 24. With a starting value of 0 the answer would be 0, since anything times 0 is 0. Starting values matter!',
        },
        {
          prompt: 'What does this print?',
          code: `const ship = { name: "Kite", crew: 4 };\nship.crew = ship.crew + 1;\nconsole.log(ship.crew);`,
          options: ['4', '5', '41', 'An error, because ship is const'],
          answer: 1,
          explain: '`const` stops you pointing `ship` at a different object. It doesn\'t stop you changing the properties of the object it points at.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'inventory-audit',
      title: 'BOSS: Inventory Audit',
      system: 'Quartermaster',
      boss: true,
      skills: ['iteration', 'objects', 'arrays'],
      ...codeFiles('inventory-audit', 'ts'),
      brief: `**ARIA:** The quartermaster's audit is overdue by three years. Every crate, every category, every coin. Map, filter, reduce, objects and sorting, all in one report.

**THE FEED:** *Viewers, the engineer is about to face the QUARTERMASTER. Nobody has survived an audit before. Well, technically everyone has, but the paperwork was devastating.*`,
      lesson: `## Composing small functions

Big problems get solved by **small functions that each do one thing**, combined. The final \`audit\` function can call the other three:

\`\`\`ts
return {
  totalValue: totalValue(items),
  lowStock: lowStock(items),
  …
};
\`\`\`

## A helper function

If you need the same calculation in several places (like an item's worth), give it a name once:

\`\`\`ts
const worth = (item: Item) => item.qty * item.price;
\`\`\`

## Sorting

\`.sort()\` sorts an array of strings alphabetically. (It changes the array in place, but after \`filter\` and \`map\` it's already a fresh array, so that's fine.)

\`\`\`ts
["Wrench", "Coolant", "Fuses"].sort();   // ["Coolant", "Fuses", "Wrench"]
\`\`\`

## Plan before you type

1. \`totalValue\`: reduce, adding each item's worth.
2. \`lowStock\`: filter → map to names → sort.
3. \`unitsByCategory\`: reduce into an object, like \`countByRole\`.
4. \`mostValuable\`: keep the best so far, like \`longestName\`.`,
      hints: [
        '`totalValue`: `items.reduce((total, item) => total + item.qty * item.price, 0)`.',
        '`lowStock`: `items.filter((i) => i.qty < 5).map((i) => i.name).sort()`. `unitsByCategory` is the tally pattern, adding `item.qty` instead of 1.',
        'In `audit`, loop to find the item with the highest `qty * price` (start with `"none"` and a best of -1), then return an object with all four answers.',
      ],
      checks: [
        { label: 'totalValue', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'totalValue')(ITEMS)).toBe(205);
          expect(fnOf(mod, 'totalValue')([])).toBe(0);
        } },
        { label: 'lowStock: under 5, sorted A→Z', run: ({ mod, expect }) => expect(fnOf(mod, 'lowStock')(ITEMS)).toEqual(['Coolant', 'Fuses', 'Wrench']) },
        { label: 'unitsByCategory', run: ({ mod, expect }) => expect(fnOf(mod, 'unitsByCategory')(ITEMS)).toEqual({ food: 40, fluids: 4, tools: 7 }) },
        { label: 'audit puts it all together', run: ({ mod, expect }) => expect(fnOf(mod, 'audit')(ITEMS)).toEqual({
          totalValue: 205,
          lowStock: ['Coolant', 'Fuses', 'Wrench'],
          unitsByCategory: { food: 40, fluids: 4, tools: 7 },
          mostValuable: 'Coolant',
        }) },
        { label: 'audit handles an empty inventory', run: ({ mod, expect }) => expect(fnOf(mod, 'audit')([])).toEqual({ totalValue: 0, lowStock: [], unitsByCategory: {}, mostValuable: 'none' }) },
        { label: 'audit doesn\'t change the items it was given', run: ({ mod, expect }) => {
          const items = ITEMS.map((i) => ({ ...i }));
          fnOf(mod, 'audit')(items);
          expect(items).toEqual(ITEMS);
        } },
      ],
    },
  ],
};
