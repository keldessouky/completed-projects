import { CONFIG } from '../config';
import type { CardDef } from '../types';
import type { World } from './world';

/**
 * Between-wave upgrade cards.
 *
 * The pool is deliberately majority *behaviour*, not percentages. A run whose
 * every upgrade is a scalar plays identically however you draft it — the cards
 * below change what appears on the screen, and the evolutions at the bottom
 * combine two you already own into a third, which is the one hook this genre
 * is actually built on.
 *
 * Offered three at a time, drawn without repetition inside an offer, and
 * weighted so situational cards (keep repair) only show up when they help.
 */
export function drawCards(world: World, count = CONFIG.cards.choices): CardDef[] {
  const C = CONFIG.cards;
  const s = world.stats;

  const pool: { card: CardDef; weight: number }[] = [
    // ---------- behaviour: these change what happens on screen
    {
      weight: s.pierce < 3 ? 16 : 0,
      card: {
        id: 'pierce', title: 'Bodkin Points', icon: 'iBolt',
        body: 'Shots punch through +1 enemy',
        apply: () => { s.pierce += 1; },
      },
    },
    {
      weight: s.fork < 4 ? 15 : 0,
      card: {
        id: 'fork', title: 'Split Volley', icon: 'iSword',
        body: 'Every shot fires +1 round at an angle',
        apply: () => { s.fork += 1; },
      },
    },
    {
      weight: s.explode < 0.9 ? 14 : 0,
      card: {
        id: 'explode', title: 'Powder Hearts', icon: 'iBolt',
        body: s.explode > 0 ? 'Corpses detonate harder' : 'Killed enemies detonate',
        apply: () => { s.explode += 0.3; },
      },
    },
    {
      weight: s.heavyEvery === 0 ? 13 : 0,
      card: {
        id: 'heavy', title: 'Siege Round', icon: 'iTower',
        body: 'Every 5th shot is a heavy splash round',
        apply: () => { s.heavyEvery = 5; },
      },
    },
    {
      weight: !s.volley ? 12 : 0,
      card: {
        id: 'volley', title: 'Fire By Rank', icon: 'iSword',
        body: 'The whole squad fires as one',
        apply: () => { s.volley = true; },
      },
    },
    {
      weight: s.aura < 4 ? 13 : 0,
      card: {
        id: 'aura', title: 'Whirling Guard', icon: 'iHeart',
        body: s.aura > 0 ? 'The blade storm bites deeper' : 'Blades circle the king, wounding all near',
        apply: () => { s.aura += 26; },
      },
    },
    {
      weight: s.chain === 0 ? 11 : 0,
      card: {
        id: 'chain', title: 'Arc Conductor', icon: 'iBolt',
        body: 'Hits arc to nearby enemies',
        apply: () => { s.chain = 1; },
      },
    },
    // ---------- evolutions: two you already hold, fused into something new
    {
      weight: s.pierce >= 2 && s.fork >= 2 && !s.evolved.lance ? 40 : 0,
      card: {
        id: 'evo_lance', title: 'EVOLVE · Lance Line', icon: 'iSword',
        body: 'Bodkin + Split: a wall of piercing shot, +2 pierce and +1 fork',
        apply: () => { s.pierce += 2; s.fork += 1; s.dmg *= 1.25; s.evolved.lance = true; },
      },
    },
    {
      weight: s.explode > 0 && s.chain > 0 && !s.evolved.storm ? 40 : 0,
      card: {
        id: 'evo_storm', title: 'EVOLVE · Chain Reaction', icon: 'iBolt',
        body: 'Powder + Arc: detonations arc onward and hit far harder',
        apply: () => { s.explode += 0.5; s.chain += 2; s.evolved.storm = true; },
      },
    },
    {
      weight: s.volley && s.heavyEvery > 0 && !s.evolved.broadside ? 40 : 0,
      card: {
        id: 'evo_broadside', title: 'EVOLVE · Broadside', icon: 'iTower',
        body: 'Rank Fire + Siege: every 3rd volley is heavy, and it hurts',
        apply: () => { s.heavyEvery = 3; s.dmg *= 1.3; s.evolved.broadside = true; },
      },
    },
    // ---------- scalars: still here, but no longer the whole menu
    {
      weight: 10,
      card: {
        id: 'dmg', title: 'Sharper Steel', icon: 'iSword',
        body: `+${Math.round(C.damage * 100)}% damage`,
        apply: () => { s.dmg *= 1 + C.damage; },
      },
    },
    {
      weight: 10,
      card: {
        id: 'rate', title: 'Drill Sergeant', icon: 'iBolt',
        body: `+${Math.round(C.fireRate * 100)}% fire rate`,
        apply: () => { s.fireRate *= 1 + C.fireRate; },
      },
    },
    {
      weight: 8,
      card: {
        id: 'range', title: 'Longer Sights', icon: 'iTower',
        body: `+${Math.round(C.range * 100)}% range`,
        apply: () => { s.range *= 1 + C.range; },
      },
    },
    {
      weight: 9,
      card: {
        id: 'soldiers', title: 'Fresh Levy', icon: 'iSword',
        body: `+${C.soldiers} soldiers`,
        apply: () => { s.extraSoldiers += C.soldiers; world.syncSquad(); },
      },
    },
    {
      weight: 8,
      card: {
        id: 'magnet', title: 'Lodestone', icon: 'iBolt',
        body: `+${Math.round(C.magnet * 100)}% pickup radius`,
        apply: () => { s.magnet *= 1 + C.magnet; },
      },
    },
    {
      weight: 8,
      card: {
        id: 'carry', title: 'Deeper Pockets', icon: 'iCheck',
        body: `+${Math.round(C.carry * 100)}% carry capacity`,
        apply: () => { s.carry *= 1 + C.carry; },
      },
    },
    {
      weight: 7,
      card: {
        id: 'coin', title: 'Spoils of War', icon: 'iCheck',
        body: `+${Math.round(C.coinBonus * 100)}% coin value`,
        apply: () => { s.coin *= 1 + C.coinBonus; },
      },
    },
    {
      weight: 6,
      card: {
        id: 'move', title: 'Swift Boots', icon: 'iBolt',
        body: `+${Math.round(C.moveSpeed * 100)}% move speed`,
        apply: () => { s.moveSpeed *= 1 + C.moveSpeed; },
      },
    },
    {
      // only worth offering when the keep is actually hurt
      weight: world.fort.keepHp < world.fort.keepMaxHp * 0.85 ? 14 : 0,
      card: {
        id: 'repair', title: 'Masons at Work', icon: 'iHeart',
        body: `Repair ${Math.round(C.keepRepair * 100)}% of the keep`,
        apply: () => {
          world.fort.keepHp = Math.min(
            world.fort.keepMaxHp,
            world.fort.keepHp + world.fort.keepMaxHp * C.keepRepair,
          );
        },
      },
    },
  ];

  const picks: CardDef[] = [];
  const avail = pool.filter((p) => p.weight > 0);
  while (picks.length < count && avail.length > 0) {
    let total = 0;
    for (const p of avail) total += p.weight;
    let r = Math.random() * total;
    let idx = 0;
    for (let i = 0; i < avail.length; i++) {
      r -= avail[i].weight;
      if (r <= 0) { idx = i; break; }
    }
    picks.push(avail[idx].card);
    avail.splice(idx, 1);
  }
  return picks;
}
