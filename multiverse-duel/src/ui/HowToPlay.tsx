// Rules in brief, including exactly where this game simplifies real Magic.
export function HowToPlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="How to play">
        <div className="modal-head">
          <h3>How to play</h3>
          <button type="button" className="close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body help">
          <p>Play against 1 to 3 computer opponents. Everyone starts at <strong>20 life</strong>; a player at 0 life, or who must draw from an empty library, is out and their permanents leave the game. The last player standing wins.</p>
          <h4>Your turn</h4>
          <ol>
            <li><strong>Main phase.</strong> Click a land in your hand to play it (one per turn). Click any glowing card to cast it — mana is paid automatically from your untapped lands. If it needs a target, the legal targets glow green: click one (or a player’s life total).</li>
            <li><strong>Attack.</strong> Press <em>Attack</em>, click the creatures that should attack, then confirm. With several opponents, click an opponent’s life total to choose whom the next creatures you click will attack — you can split your attackers between players. Creatures can’t attack the turn they arrive (summoning sickness) unless they have haste.</li>
            <li><strong>Damage.</strong> The players you attacked declare blockers; you can still cast instants before pressing <em>Deal combat damage</em>.</li>
            <li><strong>Second main phase</strong>, then <em>End turn</em>. <kbd>Space</kbd> presses the highlighted button, <kbd>Esc</kbd> cancels.</li>
          </ol>
          <h4>Their turns</h4>
          <p>Computer players also attack each other. When one attacks you, click one of your untapped creatures and then the attacker it should block (repeat for more blocks; click a blocker again to undo). You can cast instants while blocking. Then confirm.</p>
          <h4>Click your permanents</h4>
          <p>Creatures and artifacts with activated abilities (like “{'{T}'}: deal 1 damage to any target”) and equipment are used by clicking them on the battlefield.</p>
          <h4>Keywords simulated</h4>
          <p>Flying, reach, haste, vigilance, trample, lifelink, deathtouch, first strike, double strike, defender, menace, indestructible, hexproof, shroud, flash, prowess and “can’t be blocked”. Auras, equipment, anthems (“creatures you control get +1/+1”), tokens, +1/+1 counters, fights, card draw, discard, life gain and loss, and enters / attacks / dies / upkeep / end-step triggers work too.</p>
          <h4>Simplified on purpose</h4>
          <ul>
            <li>There is no stack: spells resolve as soon as they’re cast, so there are no counterspells.</li>
            <li>“Each opponent” means every opponent still in the game; “any target” can be any player.</li>
            <li>Targets for triggers other than “when this enters” are picked automatically.</li>
            <li>{'{C}'} and snow mana are paid like generic mana; hybrid and Phyrexian mana are paid with a coloured mana.</li>
            <li>Rules text the game doesn’t understand is ignored, and it says so: point at any card and the panel on the right lists each ability with a ✓ (simulated) or ✗ (not simulated). Decks prefer fully simulated cards; spells that would do nothing are never put in a deck.</li>
          </ul>
          <h4>Card grades</h4>
          <p>Every card has a grade: <strong>S</strong> bomb (gold), <strong>A</strong> excellent (violet), <strong>B</strong> solid (blue), <strong>C</strong> playable, <strong>D</strong> filler (faded). It blends the card’s strength in this game for its mana cost, how widely it’s played in real Magic, and its rarity. Each deck shows its overall strength and, after a reroll, whether the new deck is better or worse than the last one.</p>
          <h4>Decks</h4>
          <p><strong>Universal</strong> builds from every card in the database. A <strong>theme</strong> builds from one franchise (cards that debuted in its sets), plane, creature type, play style, era, single set or a free-text search. When a theme doesn’t have enough cards in its colours, the deck is topped up with “filler” from the wider multiverse, marked in the deck list.</p>
          <p className="muted small">Card data and images come from <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>. Magic: The Gathering is © Wizards of the Coast; this is an unofficial fan project, not approved or endorsed by Wizards.</p>
        </div>
      </div>
    </div>
  );
}
