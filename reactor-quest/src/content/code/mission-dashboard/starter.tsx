// FINAL BOSS — Mission Control Dashboard.
// Everything a real production screen needs, in one component.
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';

export type Ship = { id: string; name: string; status: 'docked' | 'in-flight'; crew: number };
type Filter = 'all' | 'docked' | 'in-flight';

// <MissionDashboard loadShips={...} />
//
// Loading:   <p className="loading">Loading fleet…</p>
// Failure:   <p role="alert">Fleet unavailable: <message></p> and a <button>Retry</button>
// Loaded:
//   <input aria-label="Search ships" />         case-insensitive match on name
//   three filter buttons: All / Docked / In flight, the active one aria-pressed="true"
//   <p className="summary">3 of 5 ships</p>      matching vs total
//   a <ul> of ships sorted by name A→Z, each a <button> with the ship name
//   nothing matches → <p className="empty">No ships match</p> instead of the list
//   clicking a ship opens <aside aria-label="Ship details"> showing
//     <h3>{name}</h3> and <p>{crew} crew · {status}</p>   (status as "docked" / "in flight")
//   inside the aside, a <button>Close</button> — and the Escape key also closes it
export function MissionDashboard({ loadShips }: { loadShips: () => Promise<Ship[]> }) {
  // TODO
}
