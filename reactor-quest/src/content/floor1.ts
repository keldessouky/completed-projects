import type { Deck } from '../game/types';
import { blankPage, codeFiles, fnOf, line, mustNotUse, mustUse } from './helpers';

export const floor1: Deck = {
  id: 'boot',
  name: 'Boot Sequence',
  subtitle: 'Your first lines of code',
  outcome: 'You can write small programs: values, variables, decisions and functions.',
  hue: 205,
  levels: [
    {
      kind: 'code',
      id: 'hello-world',
      title: 'Hello, Orrery',
      system: 'Main Console',
      skills: ['output'],
      ...codeFiles('hello-world', 'ts'),
      brief: `**ARIA:** Oh good, you're awake. Orrery Station has been dark for nine days, and you are — I'm told — the new repair engineer. You've never written code? Excellent. Neither had anyone else who came aboard. Most of them are fine.

Every system on this station runs on code, and every system is down. We start with the main console. It just needs to say something.

**THE FEED:** *Welcome, viewers, to Repair Crew LIVE! Our new engineer is about to write their very first line of code. Statistically, this is where things get funny.*`,
      lesson: `## What is code?

Code is a list of instructions for a computer, written in a language it understands. You'll be writing **TypeScript**, which is **JavaScript** with a few extras. JavaScript runs every website you've ever used.

The computer reads your instructions **top to bottom**, one at a time.

## Printing a message

This instruction prints a message to the **console**, the text output panel shown on the right after you press **Run**:

\`\`\`ts
console.log("Hello, world");
\`\`\`

- \`console.log\` means "print this".
- The message goes inside the parentheses \`( )\`.
- Text goes inside quotes: \`"like this"\`.
- The line ends with a semicolon \`;\`, like a full stop.

## Comments

A line starting with \`//\` is a **comment**: a note for people. The computer ignores it completely. The starter code uses comments to tell you what to do.

## Running your code

Press **Run** (or ⌘↵). Your code runs, and the **Checks** panel tells you whether it did what the mission asked. A red ✗ isn't failure. It's information. Every programmer sees hundreds of them a day.`,
      hints: [
        'Delete the `//` at the start of the last line, so it stops being a comment.',
        'Change the words inside the quotes from `Hello, world` to `Hello, Orrery`. Keep the quotes.',
        'The whole program is one line: `console.log("Hello, Orrery");`',
      ],
      checks: [
        { label: 'Prints "Hello, Orrery"', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('Hello, Orrery') },
      ],
    },
    {
      kind: 'code',
      id: 'strings',
      title: 'Strings',
      system: 'Status Display',
      skills: ['output'],
      ...codeFiles('strings', 'ts'),
      brief: `**ARIA:** The console spoke! The crew is weeping openly. Next: the status display. It needs to stick two pieces of text together, and count letters. Computers are excellent at both. People are surprisingly bad at the second one.`,
      lesson: `## Strings

A piece of text in code is called a **string**: characters strung together between quotes. Double \`"..."\` and single \`'...'\` quotes both work.

\`\`\`ts
"Orrery"
'Deck 7'
\`\`\`

## Joining strings with +

The \`+\` sign glues strings together. This is called **concatenation**:

\`\`\`ts
console.log("Deck " + "Seven");   // Deck Seven
\`\`\`

Spaces only appear where you put them, so \`"Deck" + "Seven"\` is \`DeckSeven\`.

## How long is a string?

Add \`.length\` to a string to get the number of characters in it:

\`\`\`ts
console.log("Kite".length);   // 4
\`\`\`

That dot means "give me something that belongs to this value". You'll see dots everywhere in code.`,
      hints: [
        'For line 1, put `+ "ONLINE"` after `"Status: "` inside the parentheses.',
        'For line 2, put `.length` straight after the closing quote of `"Orrery"`.',
        'Line 1: `console.log("Status: " + "ONLINE");`. Line 2: `console.log("Orrery".length);`',
      ],
      checks: [
        { label: 'Line 1 prints "Status: ONLINE"', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('Status: ONLINE') },
        { label: 'Line 2 prints the length of "Orrery" (6)', run: ({ logs, expect }) => expect(line(logs, 1)).toBe('6') },
        { label: 'Joins with + and measures with .length', run: ({ source }) => {
          mustUse(source, /"Status: "\s*\+\s*"ONLINE"/, 'Build line 1 by joining "Status: " and "ONLINE" with +.');
          mustUse(source, /\.length/, 'Use .length to measure the word instead of counting it yourself.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'numbers',
      title: 'Numbers and Maths',
      system: 'Power Calculator',
      skills: ['output'],
      ...codeFiles('numbers', 'ts'),
      brief: `**ARIA:** The power calculator has four sums to do, and it's doing all four of them wrong. It was programmed in a hurry, by someone who clearly hated maths. Let the computer do the arithmetic. That's what it's for.`,
      lesson: `## Numbers

Numbers are written without quotes: \`42\`, \`3.5\`, \`-10\`. (\`"42"\` with quotes is a *string* that happens to contain digits. That's a different thing, and it causes real bugs.)

## Arithmetic

| Symbol | Meaning | Example | Result |
|---|---|---|---|
| \`+\` | add | \`7 + 2\` | \`9\` |
| \`-\` | subtract | \`7 - 2\` | \`5\` |
| \`*\` | multiply | \`7 * 2\` | \`14\` |
| \`/\` | divide | \`7 / 2\` | \`3.5\` |
| \`%\` | remainder | \`7 % 2\` | \`1\` |

\`%\` (called *modulo*) gives what's **left over** after dividing. \`17 % 5\` is \`2\`, because 5 goes into 17 three times with 2 left over.

## Order of operations

Like in maths, \`*\` and \`/\` happen before \`+\` and \`-\`. Use parentheses to change the order:

\`\`\`ts
console.log(2 + 3 * 4);     // 14  (3 * 4 first)
console.log((2 + 3) * 4);   // 20  (2 + 3 first)
\`\`\``,
      hints: [
        'Three cores of 140 each: that\'s multiplication, `3 * 140`.',
        'For one deck\'s share, divide the whole total by 4. Wrap the total in parentheses: `(3 * 140) / 4`. For leftovers, use `%`.',
        'The four lines: `3 * 140`, `(3 * 140) / 4`, `17 % 5`, `(2 + 3) * 4`.',
      ],
      checks: [
        { label: 'Total power is 420', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('420') },
        { label: 'Each deck gets 105', run: ({ logs, expect }) => expect(line(logs, 1)).toBe('105') },
        { label: '2 crates left over', run: ({ logs, expect }) => expect(line(logs, 2)).toBe('2') },
        { label: '(2 + 3) × 4 is 20', run: ({ logs, expect }) => expect(line(logs, 3)).toBe('20') },
        { label: 'The computer does the maths', run: ({ source }) => mustNotUse(source, /\b(420|105|20)\b/, 'Write the calculation, not the answer. Let the computer work it out.') },
      ],
    },
    {
      kind: 'code',
      id: 'variables',
      title: 'Variables',
      system: 'Backup Generator',
      skills: ['output'],
      ...codeFiles('variables', 'ts'),
      brief: `**ARIA:** The backup generator stores the station's power level in a *variable*. Unfortunately, whoever wrote it put the power in a box that can never change. The power needs to change. That's sort of the whole point of a generator.

This is the first time the compiler will refuse your code. Don't panic. It's on your side.`,
      lesson: `## Variables

A **variable** is a named box that holds a value, so you can use the value later by its name:

\`\`\`ts
const station = "Orrery";
console.log(station);        // Orrery
\`\`\`

There are two kinds of box:

\`\`\`ts
const name = "Nova";   // const: filled once, can never be refilled
let fuel = 50;         // let:   can be refilled later
fuel = 80;             // ✅ fine, fuel is a let
name = "Kite";         // ✖ error: name is a const
\`\`\`

Use \`const\` by default. Switch to \`let\` only when the value really has to change.

## Updating a variable

The right side is worked out first, then stored in the box on the left:

\`\`\`ts
let fuel = 50;
fuel = fuel + 10;    // takes 50, adds 10, stores 60
\`\`\`

## Printing several things

\`console.log\` can print several values at once, separated by commas. It puts a space between them:

\`\`\`ts
console.log("Fuel:", fuel);   // Fuel: 60
\`\`\`

## The compiler

When you press Run, the **compiler** reads your code before it runs. If something can't work, it refuses and draws a **red squiggle** under the problem. Hover the squiggle to read the message. Reading these messages is one of the most valuable skills you'll learn here.`,
      hints: [
        'The compiler says you can\'t assign to `power` because it is a constant. Which word makes a box that *can* be refilled?',
        'Change `const power = 10;` to `let power = 10;`.',
        'At the end, add `const crew = 12;` and then `console.log(crew);`.',
      ],
      checks: [
        { label: 'Prints "Orrery 35"', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('Orrery 35') },
        { label: 'A variable named crew holds 12, and is printed', run: ({ logs, source, expect }) => {
          mustUse(source, /\b(const|let)\s+crew\s*=\s*12\b/, 'Make a variable called crew that holds 12: const crew = 12;');
          expect(line(logs, 1)).toBe('12');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'template-strings',
      title: 'Template Strings',
      system: 'Docking Announcer',
      skills: ['output'],
      ...codeFiles('template-strings', 'ts'),
      brief: `**ARIA:** The docking announcer has one message, typed in by hand. Every ship that docks is announced as "Pilot Nova at bay 7". Pilot Nova has never visited. Make the announcement build itself from the variables.`,
      lesson: `## Template strings

Gluing strings and values together with \`+\` gets hard to read fast:

\`\`\`ts
"Pilot " + pilot + " is at bay " + bay + "."
\`\`\`

A **template string** is written between **backticks** (\`\` \` \`\`), the key in the top-left of most keyboards, below Esc. Inside it, anything wrapped in \`\${ }\` is worked out and dropped into the text:

\`\`\`ts
const pilot = "Ada";
const bay = 3;
console.log(\`Pilot \${pilot} is at bay \${bay}.\`);   // Pilot Ada is at bay 3.
\`\`\`

The \`\${ }\` can hold any calculation, not just a variable name:

\`\`\`ts
console.log(\`Next bay: \${bay + 1}\`);   // Next bay: 4
\`\`\`

Template strings are how most modern JavaScript builds text. You'll use them constantly.`,
      hints: [
        'Swap the quotes on line 1 for backticks: `` `...` ``. Then replace `Nova` with `${pilot}`.',
        'Do the same for the bay and the crew: `${bay}` and `${crew}`.',
        'Line 2: ``console.log(`Crew aboard: ${crew + 2}`);``',
      ],
      checks: [
        { label: 'Prints the docking announcement', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('Pilot Nova is docking at bay 7 with 3 crew.') },
        { label: 'Prints "Crew aboard: 5"', run: ({ logs, expect }) => expect(line(logs, 1)).toBe('Crew aboard: 5') },
        { label: 'Built from the variables with ${ }', run: ({ source }) => {
          mustUse(source, /\$\{\s*pilot\s*\}/, 'Use ${pilot} in the announcement instead of typing Nova.');
          mustUse(source, /\$\{\s*bay\s*\}/, 'Use ${bay} instead of typing 7.');
          mustUse(source, /\$\{\s*crew\s*\}/, 'Use ${crew} instead of typing 3.');
          mustNotUse(source, /Crew aboard: 5/, 'Work out the 5 inside ${ } instead of typing it.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'comparisons',
      title: 'True or False',
      system: 'Sensor Grid',
      skills: ['logic'],
      ...codeFiles('comparisons', 'ts'),
      brief: `**ARIA:** The sensor grid answers yes-or-no questions all day. Is the fuel low? Is the hull intact? Is the coffee machine working? (No. It never is.) Teach it to ask.`,
      lesson: `## Booleans

A **boolean** is a value that is either \`true\` or \`false\`. Nothing else. Every decision a program makes comes down to one.

## Comparisons

A comparison asks a question and gives back a boolean:

| Operator | Question | Example | Result |
|---|---|---|---|
| \`===\` | is equal to? | \`5 === 5\` | \`true\` |
| \`!==\` | is NOT equal to? | \`5 !== 5\` | \`false\` |
| \`<\` | less than? | \`3 < 8\` | \`true\` |
| \`>\` | greater than? | \`3 > 8\` | \`false\` |
| \`<=\` | less than or equal? | \`8 <= 8\` | \`true\` |
| \`>=\` | greater than or equal? | \`7 >= 8\` | \`false\` |

They work on strings too: \`"Kite" === "Kite"\` is \`true\`.

**Careful:** one \`=\` *stores* a value in a variable. Three \`===\` *compares* two values. Mixing them up is one of the most common beginner bugs.

## Storing a boolean

A boolean is a value like any other, so it can go in a variable:

\`\`\`ts
const isLow = fuel < 50;
console.log(isLow);   // true or false
\`\`\``,
      hints: [
        'Each question is one `console.log(...)` with a comparison inside, e.g. `console.log(fuel < 50);`.',
        '"Exactly 35" is `===`; "NOT called Swift" is `!==`; "at least 40" means 40 counts too, so `>=`.',
        'The four lines: `fuel < 50`, `fuel === 35`, `hull !== "Swift"`, `fuel >= 40`.',
      ],
      checks: [
        { label: 'Fuel is less than 50 → true', run: ({ logs, expect }) => expect(line(logs, 0)).toBe('true') },
        { label: 'Fuel is exactly 35 → true', run: ({ logs, expect }) => expect(line(logs, 1)).toBe('true') },
        { label: 'Hull is not "Swift" → true', run: ({ logs, expect }) => expect(line(logs, 2)).toBe('true') },
        { label: 'Fuel is at least 40 → false', run: ({ logs, expect }) => expect(line(logs, 3)).toBe('false') },
        { label: 'Asks with comparisons', run: ({ source }) => {
          mustUse(source, /fuel\s*</, 'Compare fuel with < for question 1.');
          mustUse(source, /===/, 'Use === to check for "exactly".');
          mustUse(source, /!==/, 'Use !== to check for "NOT equal".');
          mustUse(source, />=/, 'Use >= for "at least".');
          mustNotUse(source, /console\.log\(\s*(true|false)\s*\)/, 'Print the comparison itself, not true or false typed by hand.');
        } },
      ],
    },
    {
      kind: 'code',
      id: 'functions',
      title: 'Functions',
      system: 'Fabricator',
      skills: ['functions'],
      ...codeFiles('functions', 'ts'),
      brief: `**ARIA:** The fabricator builds things from recipes. In code, recipes are called **functions**: write one once, then use it as many times as you like with different ingredients.

From now on, the checks don't just read what you print. They **call your functions** with test values and inspect what comes back.`,
      lesson: `## Functions

A **function** is a named, reusable piece of code. You give it **inputs**, it does some work, and it **returns** an output:

\`\`\`ts
export function double(n: number): number {
  return n * 2;
}
\`\`\`

Piece by piece:
- \`function double\`: the function is called \`double\`.
- \`(n: number)\`: it has one **parameter**, \`n\`. That's a name for whatever input it gets. \`: number\` says the input must be a number.
- \`: number\` after the parentheses: it gives back a number.
- \`return n * 2;\`: work out \`n * 2\` and hand it back. \`return\` ends the function.
- \`export\`: lets other code use it. Here, "other code" is the station's tests.

## Calling a function

Write its name with the inputs in parentheses:

\`\`\`ts
double(4);                  // 8
double(10);                 // 20
console.log(double(3));     // prints 6
\`\`\`

## Several parameters

Separate them with commas:

\`\`\`ts
function area(width: number, height: number): number {
  return width * height;
}
area(3, 4);   // 12
\`\`\`

## Types, briefly

Those \`: number\` and \`: string\` labels are **TypeScript types**. They let the compiler catch mistakes like \`double("four")\` before the code ever runs. You'll learn them properly on Floor 4. For now: numbers are \`number\`, text is \`string\`, true/false is \`boolean\`.`,
      hints: [
        'In `square`, replace `return 0;` with a return of `n` multiplied by itself.',
        'Start greet like this: `export function greet(name: string): string {`. Don\'t forget the closing `}`.',
        'Inside greet: `return "Welcome aboard, " + name + "!";`',
      ],
      typeChecks: [
        { label: 'greet takes a string and returns a string', code: `import { greet } from './solution';\nconst s: string = greet('Ada');\n// @ts-expect-error\ngreet(5);` },
      ],
      checks: [
        { label: 'square(4) is 16', run: ({ mod, expect }) => expect(fnOf(mod, 'square')(4)).toBe(16) },
        { label: 'square(-3) is 9', run: ({ mod, expect }) => expect(fnOf(mod, 'square')(-3)).toBe(9) },
        { label: 'greet("Ada") is "Welcome aboard, Ada!"', run: ({ mod, expect }) => expect(fnOf(mod, 'greet')('Ada')).toBe('Welcome aboard, Ada!') },
        { label: 'greet works for any name', run: ({ mod, expect }) => expect(fnOf(mod, 'greet')('Captain Bo')).toBe('Welcome aboard, Captain Bo!') },
      ],
    },
    {
      kind: 'code',
      id: 'if-else',
      title: 'Making Decisions',
      system: 'Core Monitor',
      skills: ['logic', 'functions'],
      ...codeFiles('if-else', 'ts'),
      brief: `**ARIA:** The core monitor always reports "STABLE". It reported "STABLE" during the meltdown, too. A monitor that can't make decisions isn't a monitor. It's a sticker.`,
      lesson: `## if / else

\`if\` runs a block of code only when its condition is \`true\`:

\`\`\`ts
if (fuel < 10) {
  console.log("Refuel now!");
}
\`\`\`

The block is everything between the curly braces \`{ }\`.

Add \`else\` for "otherwise", and \`else if\` to try more conditions **in order**. The first one that's true wins, and the rest are skipped:

\`\`\`ts
function grade(score: number): string {
  if (score > 90) {
    return "A";
  } else if (score > 75) {
    return "B";
  } else {
    return "C";
  }
}
grade(95);   // "A"
grade(80);   // "B"
grade(20);   // "C"
\`\`\`

Order matters. If you checked \`score > 75\` first, a 95 would get a "B".

## Returning a condition directly

A comparison is already \`true\` or \`false\`, so you don't need an \`if\` to return it:

\`\`\`ts
// Long way:
if (age >= 18) { return true; } else { return false; }
// Short way, same result:
return age >= 18;
\`\`\``,
      hints: [
        'Check the hottest case first: `if (temp > 900) { return "OVERHEAT"; }`.',
        'Then `else if (temp > 600) { return "WARM"; }`, then `else { return "STABLE"; }`.',
        '`canLaunch` is one line: `return fuel >= 20;`',
      ],
      checks: [
        { label: '950° is "OVERHEAT"', run: ({ mod, expect }) => expect(fnOf(mod, 'coreStatus')(950)).toBe('OVERHEAT') },
        { label: '700° is "WARM"', run: ({ mod, expect }) => expect(fnOf(mod, 'coreStatus')(700)).toBe('WARM') },
        { label: 'Exactly 900° is still "WARM" (it must be *above* 900)', run: ({ mod, expect }) => expect(fnOf(mod, 'coreStatus')(900)).toBe('WARM') },
        { label: '600° and below is "STABLE"', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'coreStatus')(600)).toBe('STABLE');
          expect(fnOf(mod, 'coreStatus')(20)).toBe('STABLE');
        } },
        { label: 'canLaunch: 20 or more is true', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'canLaunch')(20)).toBe(true);
          expect(fnOf(mod, 'canLaunch')(75)).toBe(true);
        } },
        { label: 'canLaunch: below 20 is false', run: ({ mod, expect }) => expect(fnOf(mod, 'canLaunch')(19)).toBe(false) },
      ],
    },
    {
      kind: 'code',
      id: 'logic-ops',
      title: 'And, Or, Not',
      system: 'Safety Interlocks',
      skills: ['logic'],
      ...codeFiles('logic-ops', 'ts'),
      brief: `**ARIA:** The safety interlocks each check exactly one thing. The airlock checks the door but not the pressure. The alarm checks for fire but not for air. One incident report reads, in its entirety: "Well, the door was closed."`,
      lesson: `## Combining conditions

Real decisions usually depend on more than one thing. Three **logical operators** combine booleans:

| Operator | Name | True when… | Example |
|---|---|---|---|
| \`&&\` | AND | **both** sides are true | \`hasFuel && hasPilot\` |
| \`\\|\\|\` | OR | **at least one** side is true | \`isFire \\|\\| isFlood\` |
| \`!\` | NOT | the value is **false** | \`!isLocked\` |

\`\`\`ts
const canFly = fuel > 0 && pilotAboard;
const evacuate = fire || flooding;
const isOpen = !isLocked;
\`\`\`

## Ranges

"Between 10 and 20, including both" takes two comparisons joined with AND:

\`\`\`ts
temp >= 10 && temp <= 20
\`\`\`

(Maths shorthand like \`10 <= temp <= 20\` does **not** work in code.)

You can chain as many as you like: \`a && b && c\` is true only if all three are.`,
      hints: [
        '`canOpenAirlock` needs three things to all be true: the door, pressure at least 90, and pressure at most 110. Join them with `&&`.',
        '`shouldAlarm`: `return fire || oxygen < 18;`',
        '`isOffDuty` flips the input: `return !onShift;`',
      ],
      checks: [
        { label: 'Airlock opens: door closed, pressure 100', run: ({ mod, expect }) => expect(fnOf(mod, 'canOpenAirlock')(true, 100)).toBe(true) },
        { label: 'Airlock opens at exactly 90 and 110', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'canOpenAirlock')(true, 90)).toBe(true);
          expect(fnOf(mod, 'canOpenAirlock')(true, 110)).toBe(true);
        } },
        { label: 'Airlock stays shut: unsafe pressure, or door open', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'canOpenAirlock')(true, 89)).toBe(false);
          expect(fnOf(mod, 'canOpenAirlock')(true, 111)).toBe(false);
          expect(fnOf(mod, 'canOpenAirlock')(false, 100)).toBe(false);
        } },
        { label: 'Alarm: fire, or low oxygen', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'shouldAlarm')(true, 21)).toBe(true);
          expect(fnOf(mod, 'shouldAlarm')(false, 15)).toBe(true);
          expect(fnOf(mod, 'shouldAlarm')(false, 21)).toBe(false);
        } },
        { label: 'Off duty means NOT on shift', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'isOffDuty')(true)).toBe(false);
          expect(fnOf(mod, 'isOffDuty')(false)).toBe(true);
        } },
      ],
    },
    {
      kind: 'code',
      id: 'scratch-rations',
      title: 'From Scratch: Rations',
      system: 'Galley',
      skills: ['functions', 'logic', 'output'],
      ...codeFiles('scratch-rations', 'ts'),
      brief: `**ARIA:** The galley's ration planner was written by the previous cook, who has since been reassigned to a station with no kitchen. There is no code to fix. There is no code at all. Just a spec, and you.

**THE FEED:** *A blank file! Viewers, this is the moment every programmer remembers. Some of them still have nightmares. Fond ones.*`,
      lesson: blankPage(`- **Functions** take inputs and \`return\` a result: \`function double(n: number): number { return n * 2; }\`
- **Maths**: \`*\` multiplies; a function can call another function you wrote.
- **Decisions**: \`if (a >= b) { … }\` and \`return\` early.
- **Template strings** build text: \`\` \`Short by \${missing} rations\` \`\`.`),
      hints: [
        'Plan: two `export function`s. Start each with a placeholder return, then Run to see which checks are left.',
        '`rationsNeeded` is one line of maths: crew × days × 3. In `supplyReport`, call `rationsNeeded` first and keep its answer in a `const`.',
        'Compare: `if (stock >= needed) return "Enough rations";` and otherwise return a template string with `needed - stock` in it.',
      ],
      typeChecks: [
        { label: 'Both functions take numbers', code: `import { rationsNeeded, supplyReport } from './solution';\nconst n: number = rationsNeeded(2, 3);\nconst s: string = supplyReport(1, 1, 1);\n// @ts-expect-error\nrationsNeeded("2", 3);` },
      ],
      checks: [
        { label: 'rationsNeeded(4, 2) is 24', run: ({ mod, expect }) => expect(fnOf(mod, 'rationsNeeded')(4, 2)).toBe(24) },
        { label: 'rationsNeeded works for any crew and days', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'rationsNeeded')(1, 1)).toBe(3);
          expect(fnOf(mod, 'rationsNeeded')(0, 5)).toBe(0);
          expect(fnOf(mod, 'rationsNeeded')(7, 10)).toBe(210);
        } },
        { label: 'supplyReport says "Enough rations" when the stock covers it', run: ({ mod, expect }) => expect(fnOf(mod, 'supplyReport')(4, 2, 30)).toBe('Enough rations') },
        { label: 'Exactly enough counts as enough', run: ({ mod, expect }) => expect(fnOf(mod, 'supplyReport')(4, 2, 24)).toBe('Enough rations') },
        { label: 'Otherwise it says how many are missing', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'supplyReport')(4, 2, 20)).toBe('Short by 4 rations');
          expect(fnOf(mod, 'supplyReport')(1, 3, 0)).toBe('Short by 9 rations');
        } },
      ],
    },
    {
      kind: 'quiz',
      id: 'quiz-basics',
      title: 'Read the Code',
      system: 'Boot Diagnostics Terminal',
      skills: ['output', 'logic'],
      brief: `**ARIA:** Before the boot sequence, a quick check that you can *read* code as well as write it. Professional programmers spend more time reading code than writing it. Nobody tells you that up front.`,
      lesson: `## Reading code like the computer

- Work **top to bottom**, one line at a time.
- Inside an expression, parentheses go first, then \`*\` \`/\` \`%\`, then \`+\` \`-\`.
- \`+\` with a string on either side glues **text**: \`"3" + 4\` is \`"34"\`.
- \`=\` stores, \`===\` compares.
- \`return\` hands a value back **and ends the function** immediately.`,
      questions: [
        {
          prompt: 'What does this print?',
          code: `let shields = 40;\nshields = shields + 15;\nconsole.log(shields);`,
          options: ['40', '15', '55', 'shields + 15'],
          answer: 2,
          explain: 'The right side is worked out first (40 + 15 = 55), then stored back into `shields`.',
        },
        {
          prompt: 'What does this print?',
          code: `console.log("3" + 4);`,
          options: ['7', '"34"', '34', 'An error'],
          answer: 2,
          explain: 'With a string on one side, `+` joins text instead of adding. `"3" + 4` becomes the string `34`. Mixing up numbers and number-looking strings is a classic bug, and TypeScript helps you catch it.',
        },
        {
          prompt: 'What does this print?',
          code: `console.log(10 - 4 / 2);`,
          options: ['3', '8', '6', '2'],
          answer: 1,
          explain: 'Division happens before subtraction: `4 / 2` is 2, then `10 - 2` is 8.',
        },
        {
          prompt: 'Which line is a mistake?',
          code: `const crew = 4;\nlet fuel = 20;\nfuel = 30;\ncrew = 5;`,
          options: ['Line 1', 'Line 2', 'Line 3', 'Line 4'],
          answer: 3,
          explain: '`crew` is a `const`, so it can never be given a new value. The compiler stops you right there.',
        },
        {
          prompt: 'What does `check(5)` return?',
          code: `function check(n: number): string {\n  if (n > 3) {\n    return "big";\n  }\n  return "small";\n}`,
          options: ['"big"', '"small"', '"big" and then "small"', 'Nothing'],
          answer: 0,
          explain: '`5 > 3` is true, so the function returns "big". `return` ends the function immediately, so the last line never runs.',
        },
        {
          prompt: 'What does this print?',
          code: `const fuel = 15;\nconst docked = false;\nconsole.log(fuel > 10 && !docked);`,
          options: ['true', 'false', '15', 'docked'],
          answer: 0,
          explain: '`fuel > 10` is true, and `!docked` flips false to true. true AND true is true.',
        },
      ],
    },
    {
      kind: 'code',
      id: 'boot-diagnostics',
      title: 'BOSS: Boot Diagnostics',
      system: 'Boot Sequence',
      boss: true,
      skills: ['functions', 'logic', 'output'],
      ...codeFiles('boot-diagnostics', 'ts'),
      brief: `**ARIA:** The boot sequence. Everything you've learned on this floor, in one program: maths, strings, decisions, combined conditions, functions that call other functions, and printing the result.

**THE FEED:** *And here it is, folks — the engineer's first BOSS! Our bookmakers give them 3-to-1 odds. Our bookmakers have never written a line of code in their lives.*`,
      lesson: `## Functions using functions

The output of one function can be the input of another:

\`\`\`ts
function double(n: number): number { return n * 2; }
function describe(n: number): string { return \`Value: \${n}\`; }

console.log(describe(double(21)));   // Value: 42
\`\`\`

Work from the **inside out**: \`double(21)\` runs first, and its result (42) goes into \`describe\`.

## Building strings in branches

Each branch of an \`if\` can return a different template string:

\`\`\`ts
if (fuel === 0) {
  return \`\${ship}: EMPTY\`;
} else if (fuel < 20) {
  return \`\${ship}: LOW (\${fuel})\`;
}
\`\`\`

## A checklist for any program

1. Read the task. Write down an example input and the output you expect.
2. Write the simplest version that handles one case. Run it.
3. Add the next case. Run it again.

Small steps, run often. That's how professionals work too.`,
      hints: [
        '`powerLevel`: `return 50 + generators * 125;` (multiplication happens first).',
        '`systemReport`: check `power === 0` first, then `power < 100`, then `else`. Each branch returns a template string like ``\`${name}: LOW (${power})\` ``.',
        '`readyToBoot` joins four comparisons with `&&`. The last line is `console.log(systemReport("Reactor", powerLevel(3)));`',
      ],
      checks: [
        { label: 'powerLevel(0) is 50, powerLevel(2) is 300', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'powerLevel')(0)).toBe(50);
          expect(fnOf(mod, 'powerLevel')(2)).toBe(300);
        } },
        { label: 'An OFFLINE report', run: ({ mod, expect }) => expect(fnOf(mod, 'systemReport')('Comms', 0)).toBe('Comms: OFFLINE') },
        { label: 'A LOW report', run: ({ mod, expect }) => expect(fnOf(mod, 'systemReport')('Comms', 40)).toBe('Comms: LOW (40)') },
        { label: 'An ONLINE report (100 counts as online)', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'systemReport')('Air', 300)).toBe('Air: ONLINE (300)');
          expect(fnOf(mod, 'systemReport')('Air', 100)).toBe('Air: ONLINE (100)');
        } },
        { label: 'readyToBoot when everything is in order', run: ({ mod, expect }) => {
          expect(fnOf(mod, 'readyToBoot')(250, 1, true)).toBe(true);
          expect(fnOf(mod, 'readyToBoot')(900, 6, true)).toBe(true);
        } },
        { label: 'readyToBoot refuses if anything is wrong', run: ({ mod, expect }) => {
          const ready = fnOf(mod, 'readyToBoot');
          expect(ready(249, 3, true)).toBe(false);
          expect(ready(300, 0, true)).toBe(false);
          expect(ready(300, 7, true)).toBe(false);
          expect(ready(300, 3, false)).toBe(false);
        } },
        { label: 'Prints the Reactor report', run: ({ logs, source, expect }) => {
          expect(line(logs, 0)).toBe('Reactor: ONLINE (425)');
          mustUse(source, /systemReport\(\s*["'`]Reactor["'`]\s*,\s*powerLevel\(\s*3\s*\)\s*\)/, 'Build the report by calling systemReport("Reactor", powerLevel(3)).');
        } },
      ],
    },
  ],
};
