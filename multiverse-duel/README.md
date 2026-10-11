# Multiverse Duel

A simple Magic: The Gathering game for **2 to 4 players** — you against 1, 2 or 3 computer opponents — in your browser, built on **every real Magic card**: 32,324 unique cards folded from 97,578 printings in 630 sets, from Limited Edition Alpha (1993) through the sets announced as of October 2026.

Pick the number of players (you + 1–3 computers), then build each player's deck one of two ways:

- **Universal**: a deck drawn from the entire multiverse, with every set, franchise and era in one pool.
- **Themed**: choose a theme for each side, for example *The Lord of the Rings* vs *Warhammer 40,000*, or *Innistrad* vs *Dragons*:
  - **Franchises**: The Lord of the Rings, The Hobbit, Warhammer 40,000, Doctor Who, Fallout, Assassin's Creed, Final Fantasy, Marvel, Spider-Man, Avatar: The Last Airbender, Teenage Mutant Ninja Turtles, Star Trek, Jurassic World, Transformers, Dungeons & Dragons, or all Universes Beyond at once. A franchise deck uses only cards that *debuted* in that franchise's sets, not reprints like Sol Ring.
  - **Planes**: Dominaria, Ravnica, Innistrad, Zendikar, Kamigawa, Theros, Mirrodin and New Phyrexia, Lorwyn, Tarkir, Ixalan, Eldraine, Kaladesh, Amonkhet, Strixhaven, Kaldheim, Bloomburrow, Duskmourn and more (26 in all).
  - **Creature types**: 34 of them, from Dragons, Elves, Goblins and Zombies to Slivers, Eldrazi and Ninjas.
  - **Play styles**: Skies, Burn, Control, Go Wide, +1/+1 Counters, Big Stompy, Deathtouch & Lifelink, Vanilla Beaters, Artifacts, Legends, Auras & Equipment.
  - **Eras**: Alpha & Beta, the 1990s, 2000s, 2010s, 2020s, and the last two years.
  - **Sets**: any one of 276 sets (every expansion, core set, Commander and Masters set, and more).
  - **Search**: any words, matched against card names, type lines and rules text.

You can also fix the colors for either deck or leave them on Auto. **Reroll** builds a new deck from the same choices, and the **Card library** lets you browse and search the whole collection.

## Play it (macOS)

1. Install [Node.js](https://nodejs.org) 20.19 or newer, if you don't have it (`brew install node` works too).
2. Double-click **`Multiverse Duel.command`** in Finder. The first launch installs dependencies and builds the game, which takes about a minute. Later launches open straight away in your default browser at <http://localhost:4321>. Close the Terminal window to stop the game.

   If macOS says the file can't be opened because it's from an unidentified developer, right-click it and choose **Open**, or run `chmod +x "Multiverse Duel.command"` once.

From a terminal you can run the same thing with `npm start`, or use `npm run dev` for a hot-reloading dev server.

Card images load from Scryfall's image servers, so you need to be online to see them. Offline, every card is drawn as a text frame and the game still works.

## How a game goes

Each deck has 40 cards: 23 spells and 17 basic lands. Every player starts at 20 life with 7 cards (a hand with fewer than 2 or more than 5 lands is redrawn once). You play one land per turn and click any glowing card to cast it; mana is paid automatically from your untapped lands. When a spell needs a target, the legal targets glow green. To attack, click your creatures and confirm; with several opponents, click an opponent's life total to choose whom your next attackers go after, so you can split an attack between players. When you're attacked, click one of your creatures and then the attacker it should block. You can cast instants while blocking, and after the opponent blocks your attack. <kbd>Space</kbd> presses the highlighted button and <kbd>Esc</kbd> cancels. Point at any card and the panel on the right shows it full size, with its live power and toughness.

### What's simulated

Writing a full Magic rules engine is a different project, so this game recognizes the rules text patterns that make up most of a typical deck and is upfront about the rest:

- **Keywords**: flying, reach, haste, vigilance, trample, lifelink, deathtouch, first strike, double strike, defender, menace, indestructible, hexproof, shroud, flash, prowess, "can't be blocked", "can't block"
- **Spells and abilities**: damage, destroy and exile, bounce, tap and untap, pump and shrink (+N/+N or −N/−N until end of turn), +1/+1 counters, tokens, fights, card draw and discard, life gain and loss, mass damage and wraths, and modal "Choose one —" spells
- **Permanents**: auras, equipment (equip), anthems ("creatures you control get +1/+1"), mana creatures and mana rocks, "enters tapped" and "enters with counters"
- **Triggers**: when this enters, attacks, deals combat damage to a player, or dies, plus at the beginning of your upkeep or end step
- **Activated abilities** paid with mana and/or {T}, such as "{T}: deals 1 damage to any target"

The card panel marks each line of rules text with ✓ (simulated) or ✗ (not simulated). About 22,000 of the cards can appear in generated decks. The deck builder prefers fully simulated cards, and it never includes a spell that would do nothing.

**Simplified on purpose**: there is no stack, so spells resolve immediately and there are no counterspells. Targets of triggers other than "enters" are chosen automatically. {C} and snow mana are paid like generic mana, and hybrid and Phyrexian mana are paid with colored mana. Planeswalkers, battles, sagas, vehicles and X spells are left out of generated decks, but they're all in the library.

**Multiplayer** is a free-for-all. Computer players attack each other as well as you, each attacking creature picks one opponent, and only the player being attacked can block it. "Each opponent" hits every opponent still in the game. A player at 0 life, or who has to draw from an empty library, is out: their permanents leave and their turns are skipped. The last player standing wins. If you're knocked out, you can watch the computers finish.

The computer players play by heuristics. Each one plays lands and the best spell it can afford, picks removal targets by threat, goes for a kill on any opponent it can finish (otherwise it attacks the most weakly defended one) and avoids attacks that blocks would punish, blocks to make good trades or to survive, and uses instant-speed removal and tricks during combat. It never looks at your hand or library.

## Card data

`public/data/cards.json.gz` is a 4.4 MB snapshot built from [Scryfall](https://scryfall.com/docs/api)'s *Default Cards* bulk file. The build keeps every paper and MTGO card and leaves out tokens, art cards, silver-border and acorn un-cards, and digital-only Alchemy cards. To refresh it after new sets come out:

```sh
npm run cards:update        # downloads ~80 MB from Scryfall, writes the snapshot
```

## Development

```sh
npm install
npm run dev        # http://localhost:5180
npm test           # parser, mana, rules, deck builder, and 100+ AI-vs-AI duels and 3- and 4-player games on real decks
npm run build      # typecheck + production build
npm run smoke      # a headless Chrome bot plays full games through the UI (incl. 4 players) and checks real card art loads
npm run smoke -- --offline   # the same with Scryfall blocked, checking the drawn card frames instead
```

| Path | What it does |
| --- | --- |
| `src/data/cards.ts` | loads the snapshot and derives types, costs and stats |
| `src/data/themes.ts` | the franchise, plane, tribe, style, era, set and search themes |
| `src/game/abilities.ts` | turns rules text into simulated abilities, and lists what it can't simulate |
| `src/game/mana.ts` | mana costs, and paying them from untapped sources |
| `src/game/engine.ts` | turns, casting, targets, combat, triggers, state-based checks |
| `src/game/ai.ts` | the computer players |
| `src/game/deck.ts` | 40-card deck building with a mana curve and color fixing |
| `src/ui/` | React components: deck setup, board, card inspector, library |
| `tools/` | snapshot builder, launcher, static server and the smoke-test bot |

Built with React 19, TypeScript and Vite. There are no runtime dependencies beyond React.

---

Multiverse Duel is unofficial Fan Content permitted under the [Wizards of the Coast Fan Content Policy](https://company.wizards.com/en/legal/fancontentpolicy). It is not approved or endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast, © Wizards of the Coast LLC. Card data and images are provided by Scryfall.
