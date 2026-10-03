export interface ShieldConfig {
  strength: number;
  frequency: number;
  mode: 'pulse' | 'steady';
}

// 1. Nobody should be able to change the defaults at runtime.
export const DEFAULTS: ShieldConfig = { strength: 50, frequency: 3, mode: 'steady' };

// 2. Callers pass only the settings they want to change.
//    configure({ strength: 90 }) → defaults with strength 90
export function configure(overrides: ShieldConfig): ShieldConfig {
  return { ...DEFAULTS, ...overrides };
}

// 3. The bridge display only shows strength and mode — exactly those two.
export type ShieldSummary = ShieldConfig;

export function summarize(config: ShieldConfig): ShieldSummary {
  return { strength: config.strength, mode: config.mode };
}

// 4. One label per mode — and the compiler should insist on all of them.
export const LABELS: { [mode: string]: string } = {
  pulse: 'Pulsed',
  steady: 'Steady',
};
