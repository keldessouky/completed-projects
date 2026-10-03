// A handful of synthesized UI sounds — no audio files.
import { getSave } from './store';

let ctx: AudioContext | null = null;

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function play(fn: () => void) {
  if (!getSave().sound) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    fn();
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  click: () => play(() => tone(660, 0, 0.05, 'square', 0.03)),
  run: () => play(() => { tone(440, 0, 0.06); tone(660, 0.06, 0.08); }),
  pass: () => play(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.08))),
  fail: () => play(() => { tone(196, 0, 0.12, 'sawtooth', 0.04); tone(147, 0.1, 0.2, 'sawtooth', 0.04); }),
  right: () => play(() => { tone(880, 0, 0.06, 'triangle', 0.06); tone(1320, 0.05, 0.08, 'triangle', 0.06); }),
  wrong: () => play(() => tone(150, 0, 0.18, 'sawtooth', 0.05)),
  unlock: () => play(() => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.06))),
};
