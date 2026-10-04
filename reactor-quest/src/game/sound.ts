// A handful of synthesized UI sounds — no audio files — and, on phones, a
// matching buzz: the iPhone's Taptic Engine in the native app, the vibration
// motor on Android.
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { getSave } from './store';

const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function buzz(kind: 'tap' | 'thud' | 'success' | 'error') {
  if (!touch) return;
  const done = () => {};
  if (kind === 'tap') Haptics.impact({ style: ImpactStyle.Light }).catch(done);
  else if (kind === 'thud') Haptics.impact({ style: ImpactStyle.Medium }).catch(done);
  else Haptics.notification({ type: kind === 'success' ? NotificationType.Success : NotificationType.Error }).catch(done);
}

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
  click: () => (buzz('tap'), play(() => tone(660, 0, 0.05, 'square', 0.03))),
  run: () => (buzz('thud'), play(() => { tone(440, 0, 0.06); tone(660, 0.06, 0.08); })),
  pass: () => (buzz('success'), play(() => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.08)))),
  fail: () => (buzz('error'), play(() => { tone(196, 0, 0.12, 'sawtooth', 0.04); tone(147, 0.1, 0.2, 'sawtooth', 0.04); })),
  right: () => (buzz('tap'), play(() => { tone(880, 0, 0.06, 'triangle', 0.06); tone(1320, 0.05, 0.08, 'triangle', 0.06); })),
  wrong: () => (buzz('error'), play(() => tone(150, 0, 0.18, 'sawtooth', 0.05))),
  unlock: () => (buzz('success'), play(() => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.07, 0.25, 'triangle', 0.06)))),
};
