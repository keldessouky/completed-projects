import { CONFIG, type EnemyKind, type EraId } from '../config';
import type { World } from './world';

export type Phase = 'build' | 'fight' | 'done';

/**
 * Drives the run: alternating build lulls and waves, four waves per era,
 * five eras. The last wave of each era carries a boss, and clearing it
 * advances the age — new weapons, new towers, new palette, new music.
 */
export class WaveDirector {
  phase: Phase = 'build';
  /** 0-based index of the wave being fought or prepared for */
  wave = 0;
  /** seconds left in the current build lull */
  buildLeft: number = CONFIG.waves.firstBuildSec;
  /** how many enemies of this wave are still to spawn */
  toSpawn = 0;
  private pulse = 0;
  /** true once the final wave is beaten */
  won = false;

  onWaveStart: ((wave: number) => void) | null = null;
  onWaveClear: ((wave: number) => void) | null = null;
  onEraUp: ((era: EraId) => void) | null = null;
  onWin: (() => void) | null = null;

  constructor(private world: World) {}

  get era(): EraId {
    return Math.min(CONFIG.eras.length - 1, Math.floor(this.wave / CONFIG.waves.perEra)) as EraId;
  }

  /** Is this the boss wave that closes out an era? */
  get isBossWave(): boolean {
    return CONFIG.waves.bossOnLastOfEra && this.wave % CONFIG.waves.perEra === CONFIG.waves.perEra - 1;
  }

  /** Skip the remaining lull — the player is ready. */
  callWaveEarly(): void {
    if (this.phase === 'build') this.buildLeft = 0;
  }

  step(dt: number): void {
    if (this.phase === 'done') return;

    if (this.phase === 'build') {
      this.buildLeft -= dt;
      if (this.buildLeft <= 0) this.startWave();
      return;
    }

    // fighting: keep feeding the wave in pulses
    if (this.toSpawn > 0) {
      this.pulse -= dt;
      if (this.pulse <= 0) {
        this.pulse = CONFIG.waves.pulseInterval(this.wave);
        this.spawnPulse();
      }
      return;
    }

    // wave is fully spawned — cleared once the field is empty
    if (this.world.enemies.count === 0) this.clearWave();
  }

  private startWave(): void {
    this.phase = 'fight';
    this.toSpawn = Math.round(CONFIG.waves.count(this.wave));
    this.pulse = 0;
    this.onWaveStart?.(this.wave);
    if (this.isBossWave) this.spawnBoss();
  }

  private clearWave(): void {
    this.onWaveClear?.(this.wave);
    const eraBefore = this.era;
    this.wave++;

    if (this.wave >= CONFIG.waves.total) {
      this.phase = 'done';
      this.won = true;
      this.onWin?.();
      return;
    }

    this.phase = 'build';
    this.buildLeft = CONFIG.waves.buildSec;
    if (this.era !== eraBefore) this.onEraUp?.(this.era);
  }

  /** Choose an archetype from the wave's weighted mix. */
  private pickKind(): EnemyKind {
    const mix = CONFIG.waves.mix(this.wave);
    let total = 0;
    for (const k in mix) total += mix[k];
    let r = Math.random() * total;
    for (const k in mix) {
      r -= mix[k];
      if (r <= 0) return k as EnemyKind;
    }
    return 'runner';
  }

  /** A spawn point on one of the active map edges. */
  private edgePoint(): { x: number; y: number } {
    const size = CONFIG.world.size;
    const pad = CONFIG.world.edgePad;
    const edges = CONFIG.waves.edges(this.wave);
    const side = Math.floor(Math.random() * edges);
    const t = pad + Math.random() * (size - pad * 2);
    switch (side) {
      case 0: return { x: t, y: pad };
      case 1: return { x: size - pad, y: t };
      case 2: return { x: t, y: size - pad };
      default: return { x: pad, y: t };
    }
  }

  private spawnPulse(): void {
    const perPulse = Math.max(2, Math.round(CONFIG.waves.count(this.wave) / 7));
    const n = Math.min(this.toSpawn, perPulse);
    // a pulse arrives together, so it reads as a group pushing in
    const anchor = this.edgePoint();
    for (let i = 0; i < n; i++) {
      const x = anchor.x + (Math.random() - 0.5) * 120;
      const y = anchor.y + (Math.random() - 0.5) * 120;
      this.world.spawnEnemy(this.pickKind(), x, y, this.wave);
    }
    this.toSpawn -= n;
  }

  private spawnBoss(): void {
    const p = this.edgePoint();
    this.world.spawnEnemy('boss', p.x, p.y, this.wave);
  }
}
