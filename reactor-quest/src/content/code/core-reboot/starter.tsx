// FINAL BOSS — reboot the reactor core.
import { useEffect, useReducer, useState } from 'react';

export type Phase = 'idle' | 'charging' | 'ready' | 'online';

interface CoreConsoleProps {
  chargeMs?: number; // how long a full charge takes (tests speed it up)
  onOnline?: () => void;
}

// The console:
//   <p className="phase">Phase: idle</p>
//   <progress value={charge} max={100} />              charge goes 0 → 100
//   <button>Begin charge</button>    only enabled when idle → starts charging
//   <button>Abort</button>           only enabled while charging → back to idle, charge 0
//   <input aria-label="Authorization" />
//   <button>Ignite</button>          only enabled when ready AND the code is "REACT"
//                                    (any letter case, surrounding spaces ignored)
//
// While charging, add 10 to the charge every chargeMs / 10 milliseconds.
// At 100 the phase becomes "ready" and the timer stops.
// Ignite → phase "online", calls onOnline once,
//          and shows <p className="restored">Core online. Station restored.</p>
//
// Tip: a reducer keeps phase and charge consistent with each other.
export function CoreConsole({ chargeMs = 3000, onOnline }: CoreConsoleProps) {
  // TODO
}
