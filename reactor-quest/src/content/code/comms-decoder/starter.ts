// BOSS — Comms Decoder.
// Raw transmissions arrive as text:   "  NOVA|3|Docking at bay 7  "
//                                       from | priority | body

export type Message = { from: string; priority: number; body: string };

// 1. Parse one transmission: trim it, split on "|", and build a Message
//    (trim each part; priority becomes a number).
//    If there aren't exactly 3 parts, or the priority isn't a number, THROW
//    an Error with the message:  Corrupt transmission: <the raw text>
export function parseTransmission(raw: string): Message {
  return { from: raw, priority: 0, body: "" };
}

// 2. Decode a batch, skipping corrupt ones, and count them.
export function decodeAll(raws: string[]): { messages: Message[]; corrupt: number } {
  return { messages: [], corrupt: 0 };
}

// 3. Translate every body with the (slow, async) translator — all at once —
//    and return NEW messages with the translated bodies. Don't change the originals.
export async function translateAll(
  messages: Message[],
  translate: (text: string) => Promise<string>,
): Promise<Message[]> {
  return messages;
}

// 4. An inbox that remembers messages (use a closure):
//      add(message)   stores it
//      top()          the highest-priority message, or undefined if empty
//                     (on a tie, the one added first)
//      count()        how many are stored
export function makeInbox() {
  return {
    add: (message: Message) => {},
    top: (): Message | undefined => undefined,
    count: () => 0,
  };
}

// 5. The whole pipeline: decode the raws, translate them, add them to a new inbox,
//    and report:  { count, corrupt, topFrom }   (topFrom: the top message's sender,
//    or "nobody" if there are no messages)
export async function processBatch(raws: string[], translate: (text: string) => Promise<string>) {
  return { count: 0, corrupt: 0, topFrom: "nobody" };
}
