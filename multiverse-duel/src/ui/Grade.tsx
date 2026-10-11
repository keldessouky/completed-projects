// Card quality at a glance: S–D grade badges, grade-styled names, and a deck strength panel.
import type { ReactNode } from 'react';
import type { Card } from '../data/cards';
import { cardGrade, cardScore, GRADES, gradeInfo, type DeckStrength, type Grade } from '../game/quality';

export function GradeBadge({ card, grade, size = 'sm' }: { card?: Card; grade?: Grade; size?: 'sm' | 'md' | 'lg' }) {
  const g = grade ?? cardGrade(card!);
  const info = gradeInfo(g);
  const title = card ? `Grade ${g} — ${info.name} (${cardScore(card)}/100, ${info.blurb})` : `Grade ${g} — ${info.name}`;
  return (
    <span className={`grade-badge g-${g} ${size}`} title={title} aria-label={title}>
      {g}
    </span>
  );
}

/** A card name styled by its grade: bombs stand out, filler recedes. */
export function GradedName({ card, children }: { card: Card; children?: ReactNode }) {
  return <span className={`graded q-${cardGrade(card)}`}>{children ?? card.name}</span>;
}

export function GradeLegend() {
  return (
    <div className="grade-legend" aria-label="Card grades">
      <span className="muted small">Card grades</span>
      {GRADES.map((g) => (
        <span key={g.grade} className="legend-item" title={g.blurb}>
          <GradeBadge grade={g.grade} />
          <span className={`graded q-${g.grade}`}>{g.name}</span>
        </span>
      ))}
      <span
        className="muted small legend-help"
        title="Each card's score (0–100) blends its strength in this game for its mana cost, how widely it's played in real Magic (EDHREC rank) and its rarity, then ranks it against every card a deck can use. 90 means better than 90% of them."
      >
        how is this scored?
      </span>
    </div>
  );
}

export function DeckStrengthPanel({ strength, delta }: { strength: DeckStrength; delta: number | null }) {
  const total = Object.values(strength.byGrade).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className={`deck-strength ds-${strength.grade}`}>
      <div className="ds-grade" title={`Deck grade ${strength.grade}`}>
        {strength.grade}
      </div>
      <div className="ds-body">
        <div className="ds-line">
          <span className="ds-label">Deck strength</span>
          <span className="ds-score">{strength.score}</span>
          <span className="muted small">/ 100</span>
          {delta !== null && delta !== 0 && (
            <span className={`ds-delta ${delta > 0 ? 'up' : 'down'}`} title="Compared with the previous deck in this seat">
              {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs last roll
            </span>
          )}
          {delta === 0 && <span className="ds-delta same">= same as last roll</span>}
        </div>
        <div className="grade-bar" aria-label="Cards by grade">
          {(['S', 'A', 'B', 'C', 'D'] as Grade[]).map((g) =>
            strength.byGrade[g] ? (
              <span key={g} className={`gb-seg g-${g}`} style={{ flexGrow: strength.byGrade[g] / total }} title={`${strength.byGrade[g]} × grade ${g} (${gradeInfo(g).name})`}>
                {strength.byGrade[g]} {g}
              </span>
            ) : null,
          )}
        </div>
      </div>
    </div>
  );
}

