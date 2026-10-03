export interface ShieldConfig {
  strength: number;
  frequency: number;
  mode: 'pulse' | 'steady';
}

export const DEFAULTS: Readonly<ShieldConfig> = { strength: 50, frequency: 3, mode: 'steady' };

export function configure(overrides: Partial<ShieldConfig>): ShieldConfig {
  return { ...DEFAULTS, ...overrides };
}

export type ShieldSummary = Pick<ShieldConfig, 'strength' | 'mode'>;

export function summarize(config: ShieldConfig): ShieldSummary {
  return { strength: config.strength, mode: config.mode };
}

export const LABELS: Record<ShieldConfig['mode'], string> = {
  pulse: 'Pulsed',
  steady: 'Steady',
};
