import { CONFIG } from '../config';
import type { CardDef } from '../types';
import type { World } from './world';

/**
 * Between-wave upgrade cards. Offered three at a time, drawn without
 * repetition inside an offer, and weighted so situational cards (keep repair)
 * only show up when they would actually help.
 */
export function drawCards(world: World, count = CONFIG.cards.choices): CardDef[] {
  const C = CONFIG.cards;
  const s = world.stats;

  const pool: { card: CardDef; weight: number }[] = [
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
