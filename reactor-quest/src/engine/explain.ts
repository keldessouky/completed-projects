// Compiler errors, in plain English. The TypeScript compiler is precise but
// terse, and its messages are written for people who already know the
// vocabulary. For the mistakes beginners make most, this adds one sentence
// that says what went wrong and what to try. The original message is always
// shown too: learning to read it is part of the point.

type Explainer = (m: RegExpMatchArray | null, message: string) => string | null;

const short = (type: string) => (type.length > 40 ? 'a different type' : `\`${type}\``);
const didYouMean = (message: string) => message.match(/Did you mean '([^']+)'\?/)?.[1];

const EXPLAIN: Record<number, [RegExp | null, Explainer]> = {
  2322: [/^Type '(.+?)' is not assignable to type '(.+?)'\./, (m, msg) => {
    const fix = didYouMean(msg);
    if (fix) return `Probably a typo: did you mean \`${fix}\`?`;
    if (m && m[1].endsWith('| undefined')) return 'This value might be `undefined`, but it has to be there. Check that it exists first (an `if`), or give a fallback with `??`.';
    return m ? `This is ${short(m[1])}, but the code promised ${short(m[2])} here. Change the value, or the type it's going into.` : null;
  }],
  2345: [/^Argument of type '(.+?)' is not assignable to parameter of type '(.+?)'\./, (m) =>
    m ? `You passed ${short(m[1])} to a function that expects ${short(m[2])}.` : null],
  2339: [/^Property '(.+?)' does not exist on type '(.+?)'\./, (m) =>
    m ? `\`${m[1]}\` isn't something this value has. Check the spelling (capitals count). If the value could be one of several types, check which one it is first.` : null],
  2551: [/^Property '(.+?)' does not exist/, (m, msg) => `Probably a typo: you wrote \`${m?.[1]}\`, did you mean \`${didYouMean(msg)}\`?`],
  2304: [/^Cannot find name '(.+?)'\./, (m) =>
    m ? `Nothing called \`${m[1]}\` exists here. Check the spelling (capitals count), or create it before you use it.` : null],
  2552: [/^Cannot find name '(.+?)'\./, (m, msg) => `Probably a typo: you wrote \`${m?.[1]}\`, did you mean \`${didYouMean(msg)}\`?`],
  2588: [/^Cannot assign to '(.+?)'/, (m) =>
    `\`${m?.[1]}\` was made with \`const\`, so it can never change. If it needs to change, make it with \`let\`.`],
  7006: [/^Parameter '(.+?)'/, (m) =>
    `Say what type \`${m?.[1]}\` is, like \`(${m?.[1]}: number)\`. Without it, TypeScript can't check anything you do with it.`],
  7031: [/^Binding element '(.+?)'/, (m) => `Say what type \`${m?.[1]}\` is: add a type after the \`{ … }\`, like \`({ name }: { name: string })\`.`],
  18046: [/^'(.+?)' is of type 'unknown'/, (m) =>
    `\`${m?.[1]}\` could be anything, so you have to check what it is before you use it: \`typeof ${m?.[1]} === "string"\`, \`Array.isArray(${m?.[1]})\`, and so on.`],
  18047: [/^'(.+?)' is possibly 'null'/, (m) =>
    `\`${m?.[1]}\` might be \`null\`. Check it first (\`if (${m?.[1]}) { … }\`), or use \`?.\` to skip it when it's missing.`],
  18048: [/^'(.+?)' is possibly 'undefined'/, (m) =>
    `\`${m?.[1]}\` might be \`undefined\`. Check it first (\`if (${m?.[1]}) { … }\`), use \`?.\`, or give a fallback with \`??\`.`],
  2532: [null, () => 'This might be `undefined`. Check it first, or use `?.` to skip it when it\'s missing.'],
  2554: [/^Expected (\d+) arguments?, but got (\d+)/, (m) =>
    m ? `This function takes ${m[1]} input${m[1] === '1' ? '' : 's'} and you gave it ${m[2]}.` : null],
  2366: [null, () => 'Some way through this function ends without a `return`. Make sure every path (every `if` and `else`) returns a value.'],
  7030: [null, () => 'Some way through this function ends without a `return`. Make sure every path (every `if` and `else`) returns a value.'],
  2367: [null, () => 'These two can never be equal: they\'re different types. Are you comparing the right things? (A number and a string that looks like one aren\'t equal with `===`.)'],
  2741: [/^Property '(.+?)' is missing/, (m) => `The object needs a \`${m?.[1]}\` too: its type says it's required.`],
  2353: [/and '(.+?)' does not exist in type/, (m) => `\`${m?.[1]}\` isn't part of this type. Is it a typo, or does it not belong here?`],
  2349: [null, () => 'You\'re calling something that isn\'t a function. Check the name, and whether you meant to put `()` after it.'],
  2454: [/^Variable '(.+?)'/, (m) => `\`${m?.[1]}\` is used before it's been given a value. Give it one first.`],
  2307: [null, () => 'On the station, only `react` can be imported. Everything else has to be written here.'],
  1002: [null, () => 'A piece of text is missing its closing quote.'],
  1005: [/^'(.+?)' expected/, (m) => `The compiler expected a \`${m?.[1]}\` here. Look for something unfinished just before this point: a missing bracket, comma or quote.`],
  1109: [null, () => 'Something is missing here: the line stops in the middle. Check for a missing value after an operator, or an extra symbol.'],
  1128: [null, () => 'The compiler got lost here. Often there\'s one bracket too many, or one missing, just before this point. Count your `{` and `}`.'],
};

/** One plain-English sentence about a compiler error, or null if there's nothing to add. */
export function explainDiagnostic(code: number, message: string): string | null {
  const entry = EXPLAIN[code];
  if (!entry) return null;
  const [pattern, explain] = entry;
  return explain(pattern ? message.match(pattern) : null, message);
}
