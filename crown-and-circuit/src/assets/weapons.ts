import type { Anim, DirName } from './lpc';

/**
 * Era firearms, drawn onto the composited character cell.
 *
 * LPC is a medieval fantasy set: it has forty helmets and a dozen swords and
 * not one gun. The eras this game promises — musket, rifle, machine gun — have
 * no art anywhere in the library, so they are drawn here, on top of the LPC
 * frame, at the hand position for that facing.
 *
 * They are deliberately small and simple. A hand-drawn firearm competing for
 * attention with professional character art loses; a compact silhouette that
 * reads as "musket" versus "machine gun" at a glance is what the era progression
 * actually needs, and it stays out of the way of the animation underneath.
 */

/** Anchor of the weapon in a 64×64 cell, per facing: [x, y, angle]. */
const HOLD: Record<DirName, [number, number, number]> = {
  //                x   y   radians (0 = pointing right)
  right: [38, 42, 0],
  left: [26, 42, Math.PI],
  up: [26, 38, -Math.PI / 2],
  down: [38, 44, Math.PI / 2],
};

const px = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void => {
  c.fillStyle = fill;
  c.fillRect(x, y, w, h);
};

/**
 * Draw era `era`'s weapon into the cell whose top-left is (ox, oy).
 *
 * `i` of `n` is the frame's position in its animation. During an attack the
 * weapon kicks back on the frames after the shot, which is most of what sells
 * a gun as having gone off.
 */
export function eraWeapon(
  c: CanvasRenderingContext2D,
  era: number,
  anim: Anim,
  dir: DirName,
  i: number,
  n: number,
  ox: number,
  oy: number,
): void {
  if (era < 1 || era > 3) return;
  const [hx, hy, ang] = HOLD[dir];
  // recoil: the shot lands about two thirds through the attack
  const t = anim === 'walk' ? 0 : i / Math.max(1, n - 1);
  const kick = anim === 'walk' ? 0 : t > 0.6 ? -2 * (1 - (t - 0.6) / 0.4) : 0;
  // walking carries it lowered, aiming brings it level
  const droop = anim === 'walk' ? 0.5 : 0;

  // LPC's shoot cycle starts with the hands tucked in and extends them forward;
  // pushing the weapon along with it keeps it in the hands instead of hanging
  // in front of the chest
  const reach = anim === 'walk' ? 0 : t * 5;

  c.save();
  c.translate(ox + hx, oy + hy);
  c.rotate(ang + droop);
  c.translate(kick + reach, 0);
  // behind-the-back facings tuck the weapon under the body silhouette
  if (dir === 'up') c.globalAlpha = 0.9;

  // a dark keyline all round: without it the barrel disappears into whatever
  // armour it crosses, which is most of them
  const ink = '#1a1d21';
  const outline = (x: number, y: number, w: number, h: number): void => px(c, x - 1, y - 1, w + 2, h + 2, ink);

  const wood = '#6b4a2c';
  const woodLit = '#8a6238';
  const steel = '#5d646c';
  const steelLit = '#8f979f';

  if (era === 1) {
    // musket: long barrel, fat wooden stock
    outline(-6, -2, 20, 5);
    px(c, -6, -1, 8, 3, wood);
    px(c, -6, -1, 8, 1, woodLit);
    px(c, 2, -2, 12, 3, steel);
    px(c, 2, -2, 12, 1, steelLit);
    px(c, 1, 0, 2, 3, steel);
  } else if (era === 2) {
    // bolt-action rifle: slimmer, longer, with a bolt handle and a sight
    outline(-8, -2, 24, 5);
    px(c, -8, -1, 10, 3, wood);
    px(c, -8, -1, 10, 1, woodLit);
    px(c, 2, -2, 14, 3, steel);
    px(c, 2, -2, 14, 1, steelLit);
    px(c, 3, 1, 2, 2, steel);
    px(c, 8, -2, 1, 1, steelLit);
  } else {
    // machine gun: box magazine, vented barrel, bipod stub
    outline(-8, -2, 23, 6);
    outline(-4, 3, 4, 4);
    px(c, -8, -2, 10, 5, steel);
    px(c, -8, -2, 10, 1, steelLit);
    px(c, -4, 3, 4, 4, steel);          // magazine
    px(c, 2, -2, 13, 4, steel);
    px(c, 2, -2, 13, 1, steelLit);
    for (let v = 0; v < 4; v++) px(c, 5 + v * 3, 0, 1, 1, '#2f3439');
    px(c, 14, 2, 1, 3, steel);          // bipod
  }

  // muzzle flash on the frame the shot leaves
  if (anim !== 'walk' && t > 0.6 && t < 0.85) {
    px(c, 15, -3, 5, 5, '#ffe9a8');
    px(c, 18, -2, 4, 3, '#fff6d8');
  }
  c.restore();
}
