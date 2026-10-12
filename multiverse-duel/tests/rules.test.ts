// Rules text parsing, mana payment and the rules engine, on real cards from the snapshot.
import { describe, expect, test } from 'vitest';
import { abilitiesOf, parseClause, parseTarget, playability } from '../src/game/abilities';
import { chooseBlocks } from '../src/game/ai';
import { Game, type PlayerId } from '../src/game/engine';
import { parseCost, planPayment } from '../src/game/mana';
import { card } from './universe';

/** A game where both libraries are 20 Plains (so draws never end the game) and you go first. */
function setup() {
  const plains = card('Plains');
  const g = new Game([Array(20).fill(plains), Array(20).fill(plains)], { seed: 1, first: 0 });
  for (const p of g.players) p.hand = [];
  return g;
}
const lands = (g: Game, pid: PlayerId, name: string, n: number) => {
  for (let i = 0; i < n; i++) g.put(pid, card(name));
};
const inHand = (g: Game, pid: PlayerId, name: string) => g.put(pid, card(name), 'hand');

describe('parsing rules text', () => {
  test('targets and filters', () => {
    expect(parseTarget('target nonblack creature')).toEqual({ sel: 'target', what: 'creature', filter: { notColor: ['B'] } });
    expect(parseTarget('target creature an opponent controls')).toMatchObject({ what: 'creature', ctrl: 'opp' });
    expect(parseTarget('up to one target creature with flying')).toMatchObject({ optional: true, filter: { flying: true } });
    expect(parseTarget('target creature card from your graveyard')).toBeNull();
  });

  test('common effects', () => {
    expect(parseClause('~ deals 3 damage to any target')).toEqual([{ k: 'damage', n: 3, to: [{ sel: 'target', what: 'any' }] }]);
    expect(parseClause('each opponent loses 2 life and you gain 2 life')).toEqual([
      { k: 'lose', n: 2, who: { sel: 'each-opp' } },
      { k: 'gain', n: 2 },
    ]);
    expect(parseClause('create two 1/1 white soldier creature tokens with lifelink')).toEqual([
      { k: 'token', count: 2, p: 1, t: 1, name: 'Soldier', colors: ['W'], kw: ['Lifelink'] },
    ]);
    expect(parseClause('counter target spell')).toBeNull();
  });

  test('real cards', () => {
    expect(abilitiesOf(card('Vampire Nighthawk')).keywords).toEqual(new Set(['Flying', 'Deathtouch', 'Lifelink']));
    expect(abilitiesOf(card('Llanowar Elves')).mana).toEqual({ options: ['G'], amount: 1 });
    expect(abilitiesOf(card('Sol Ring')).mana).toEqual({ options: ['C'], amount: 2 });
    expect(abilitiesOf(card('Glorious Anthem')).anthem).toMatchObject({ p: 1, t: 1 });
    expect(abilitiesOf(card('Pacifism')).attach).toMatchObject({ kind: 'aura', cantAttackOrBlock: true });
    expect(abilitiesOf(card('Bonesplitter')).attach).toMatchObject({ kind: 'equipment', p: 2, equip: { generic: 1 } });
    expect(abilitiesOf(card('Flametongue Kavu')).triggers[0]).toMatchObject({ when: 'etb', effects: [{ k: 'damage', n: 4 }] });
    expect(abilitiesOf(card('Prodigal Pyromancer')).activated[0]).toMatchObject({ tap: true, effects: [{ k: 'damage', n: 1 }] });
    expect(abilitiesOf(card('Boros Charm')).modes.length).toBeGreaterThanOrEqual(1);
  });

  test('honest about what it cannot do', () => {
    expect(playability(card('Counterspell'))).toBe('none');
    expect(playability(card('Act of Treason'))).toBe('none'); // "gain control" isn't simulated
    expect(playability(card('Healing Salve'))).toBe('partial'); // one of two modes
    expect(playability(card('Grizzly Bears'))).toBe('full');
  });
});

describe('mana', () => {
  test('parses costs', () => {
    expect(parseCost('{2}{R}{R}')).toEqual({ generic: 2, pips: [['R'], ['R']], hasX: false });
    expect(parseCost('{X}{G/W}')).toEqual({ generic: 0, pips: [['G', 'W']], hasX: true });
  });

  test('pays coloured pips before generic, with the right sources', () => {
    const src = [
      { iid: 1, options: ['R' as const], amount: 1 },
      { iid: 2, options: ['G' as const], amount: 1 },
      { iid: 3, options: ['R' as const, 'G' as const], amount: 1 },
    ];
    expect(planPayment(parseCost('{R}{G}'), src)?.sort()).toEqual([1, 2]);
    expect(planPayment(parseCost('{R}{R}{G}'), src)?.sort()).toEqual([1, 2, 3]);
    expect(planPayment(parseCost('{G}{G}{G}'), src)).toBeNull();
    expect(planPayment(parseCost('{3}'), [{ iid: 9, options: ['C'], amount: 2 }, ...src.slice(0, 1)])?.sort()).toEqual([1, 9]);
  });
});

describe('the rules', () => {
  test('Lightning Bolt kills a creature or hits a player', () => {
    const g = setup();
    lands(g, 0, 'Mountain', 2);
    const bears = g.put(1, card('Grizzly Bears'));
    const bolt = inHand(g, 0, 'Lightning Bolt');
    expect(g.cast(0, bolt, { targets: [{ kind: 'perm', iid: bears }] })).toBe(true);
    expect(g.perm(bears)).toBeUndefined();
    expect(g.players[1].graveyard.map((c) => c.card.name)).toContain('Grizzly Bears');
    const bolt2 = inHand(g, 0, 'Lightning Bolt');
    expect(g.cast(0, bolt2, { targets: [{ kind: 'player', id: 1 }] })).toBe(true);
    expect(g.players[1].life).toBe(17);
    expect(g.whyNotCast(0, inHand(g, 0, 'Lightning Bolt'))).toBe('Not enough mana.');
  });

  test('a land per turn, sorcery speed, summoning sickness and haste', () => {
    const g = setup();
    const a = inHand(g, 0, 'Mountain');
    const b = inHand(g, 0, 'Mountain');
    expect(g.playLand(0, a)).toBe(true);
    expect(g.playLand(0, b)).toBe(false);
    const goblin = inHand(g, 0, 'Raging Goblin');
    const bears = g.put(0, card('Grizzly Bears'), 'battlefield', { sick: true });
    g.cast(0, goblin);
    const gob = g.players[0].battlefield.find((p) => p.card.name === 'Raging Goblin')!;
    expect(g.canAttack(gob)).toBe(true); // haste
    expect(g.canAttack(g.perm(bears)!)).toBe(false); // just arrived
  });

  test('combat: flying, first strike, deathtouch, trample and lifelink', () => {
    const g = setup();
    const angel = g.put(0, card('Serra Angel'));
    const wurm = g.put(0, card('Colossal Dreadmaw'));
    const knight = g.put(0, card('Youthful Knight'));
    const bears = g.put(1, card('Grizzly Bears'));
    const rats = g.put(1, card('Typhoid Rats'));
    const nighthawk = g.put(1, card('Vampire Nighthawk'));
    g.goToCombat();
    g.declareAttackers([angel, wurm, knight]);
    expect(g.phase).toBe('block');
    expect(g.canBlock(g.perm(bears)!, g.perm(angel)!)).toBe(false); // flying
    expect(g.declareBlockers(1, { [wurm]: [rats], [knight]: [bears], [angel]: [nighthawk] })).toBe(true);
    g.resolveCombat();
    // Dreadmaw (6/6 trample) assigns 1 to the rats and 5 tramples over, but deathtouch kills it.
    expect(g.perm(wurm)).toBeUndefined();
    expect(g.perm(rats)).toBeUndefined();
    // Youthful Knight (2/1 first strike) kills the bears before they strike back.
    expect(g.perm(knight)).toBeDefined();
    expect(g.perm(bears)).toBeUndefined();
    // Nighthawk's deathtouch kills the Angel; its lifelink gains 2.
    expect(g.perm(angel)).toBeUndefined();
    expect(g.players[1].life).toBe(20 - 5 + 2);
    expect(g.perm(angel)).toBeUndefined();
    expect(g.phase).toBe('main2');
  });

  test('menace needs two blockers; vigilance does not tap', () => {
    const g = setup();
    const brute = g.put(0, card('Boggart Brute'));
    const angel = g.put(0, card('Serra Angel'));
    const b1 = g.put(1, card('Grizzly Bears'));
    const b2 = g.put(1, card('Grizzly Bears'));
    g.goToCombat();
    g.declareAttackers([brute, angel]);
    expect(g.perm(angel)!.tapped).toBe(false);
    expect(g.perm(brute)!.tapped).toBe(true);
    expect(g.blockProblem({ [brute]: [b1] })).toMatch(/menace/);
    expect(g.declareBlockers(1, { [brute]: [b1, b2] })).toBe(true);
  });

  test('auras, equipment and anthems change the numbers', () => {
    const g = setup();
    lands(g, 0, 'Plains', 5);
    const bears = g.put(0, card('Grizzly Bears'));
    const enemy = g.put(1, card('Grizzly Bears'));
    g.cast(0, inHand(g, 0, 'Glorious Anthem'));
    expect(g.power(g.perm(bears)!)).toBe(3);
    expect(g.power(g.perm(enemy)!)).toBe(2);
    g.cast(0, inHand(g, 0, 'Bonesplitter'));
    const eq = g.players[0].battlefield.find((p) => p.card.name === 'Bonesplitter')!;
    expect(g.equip(0, eq.iid, bears)).toBe(true);
    expect(g.power(g.perm(bears)!)).toBe(5);
    const g2 = setup();
    lands(g2, 0, 'Plains', 2);
    const foe = g2.put(1, card('Grizzly Bears'));
    expect(g2.cast(0, inHand(g2, 0, 'Pacifism'), { targets: [{ kind: 'perm', iid: foe }] })).toBe(true);
    g2.endTurn();
    expect(g2.canAttack(g2.perm(foe)!)).toBe(false);
  });

  test('tokens, activated abilities and enters triggers', () => {
    const g = setup();
    lands(g, 0, 'Plains', 2);
    g.cast(0, inHand(g, 0, 'Raise the Alarm'));
    expect(g.creatures(0).map((p) => p.card.name)).toEqual(['Soldier Token', 'Soldier Token']);
    const pyro = g.put(0, card('Prodigal Pyromancer'));
    expect(g.usableAbilities(0, pyro)).toEqual([0]);
    expect(g.activate(0, pyro, 0, [{ kind: 'player', id: 1 }])).toBe(true);
    expect(g.players[1].life).toBe(19);
    expect(g.perm(pyro)!.tapped).toBe(true);
    lands(g, 0, 'Mountain', 5);
    const bears = g.put(1, card('Grizzly Bears'));
    expect(g.cast(0, inHand(g, 0, 'Flametongue Kavu'), { targets: [{ kind: 'perm', iid: bears }] })).toBe(true);
    expect(g.perm(bears)).toBeUndefined();
  });

  test('mana creatures tap for mana once they can', () => {
    const g = setup();
    g.put(0, card('Forest'));
    const elf = g.put(0, card('Llanowar Elves'), 'battlefield', { sick: true });
    expect(g.availableMana(0)).toBe(1);
    g.perm(elf)!.enteredTurn = -1;
    expect(g.availableMana(0)).toBe(2);
  });

  test('drawing from an empty library loses', () => {
    const g = setup();
    g.players[1].library = [];
    g.endTurn();
    expect(g.winner).toBe(0);
  });

  test('the AI blocks to survive lethal damage', () => {
    const g = setup();
    g.players[1].life = 3;
    const a = g.put(0, card('Grizzly Bears'));
    const b = g.put(0, card('Grizzly Bears'));
    const wall = g.put(1, card('Wall of Stone'));
    g.goToCombat();
    g.declareAttackers([a, b]);
    const blocks = chooseBlocks(g, 1);
    expect(Object.values(blocks).flat()).toContain(wall);
  });
});

describe('free-for-all with up to four players', () => {
  function table(n: number) {
    const plains = card('Plains');
    const g = new Game(Array.from({ length: n }, () => Array(20).fill(plains)), { seed: 3, first: 0 });
    for (const p of g.players) p.hand = [];
    return g;
  }

  test('seats, names and turn order', () => {
    const g = table(4);
    expect(g.players.map((p) => p.name)).toEqual(['You', 'Opponent 1', 'Opponent 2', 'Opponent 3']);
    expect(g.opponents(0)).toEqual([1, 2, 3]);
    const order = [g.active];
    for (let i = 0; i < 4; i++) {
      g.goToCombat();
      g.declareAttackers([]);
      g.endTurn();
      order.push(g.active);
    }
    expect(order).toEqual([0, 1, 2, 3, 0]);
    expect(g.round).toBe(2);
    expect(() => new Game([[]])).toThrow();
  });

  test('"each opponent" hits every opponent; any target can be any player', () => {
    const g = table(3);
    const bolt = inHand(g, 0, 'Lightning Bolt');
    g.put(0, card('Mountain'));
    expect(g.legalTargets(0, { sel: 'target', what: 'player' }).map((r) => (r.kind === 'player' ? r.id : -1))).toEqual([1, 2, 0]);
    expect(g.cast(0, bolt, { targets: [{ kind: 'player', id: 2 }] })).toBe(true);
    expect(g.players.map((p) => p.life)).toEqual([20, 20, 17]);
    g.resolve(0, null, [{ k: 'lose', n: 2, who: { sel: 'each-opp' } }, { k: 'gain', n: 2 }], []);
    expect(g.players.map((p) => p.life)).toEqual([22, 18, 15]);
  });

  test('attack different opponents; each defender blocks only its own attackers', () => {
    const g = table(3);
    const a = g.put(0, card('Grizzly Bears'));
    const b = g.put(0, card('Grizzly Bears'));
    const wall1 = g.put(1, card('Wall of Stone'));
    const wall2 = g.put(2, card('Wall of Stone'));
    g.goToCombat();
    g.declareAttackers([a, b], { [a]: 1, [b]: 2 });
    expect(g.combat!.waiting).toEqual([1, 2]);
    expect(g.canBlock(g.perm(wall2)!, g.perm(a)!)).toBe(false); // a attacks player 1, not 2
    expect(g.declareBlockers(1, { [b]: [wall1] })).toBe(false);
    expect(g.declareBlockers(1, {})).toBe(true);
    expect(g.phase).toBe('block'); // player 2 still to declare
    expect(g.hasPriority(2)).toBe(true);
    expect(g.hasPriority(1)).toBe(false);
    expect(g.declareBlockers(2, { [b]: [wall2] })).toBe(true);
    expect(g.phase).toBe('combat');
    g.resolveCombat();
    expect(g.players.map((p) => p.life)).toEqual([20, 18, 20]);
  });

  test('a player at 0 life is out, their permanents leave, and their turns are skipped', () => {
    const g = table(4);
    g.put(2, card('Grizzly Bears'));
    g.players[2].life = 1;
    lands(g, 0, 'Mountain', 1);
    expect(g.cast(0, inHand(g, 0, 'Lightning Bolt'), { targets: [{ kind: 'player', id: 2 }] })).toBe(true);
    expect(g.players[2].lost).toBe(true);
    expect(g.players[2].place).toBe(4);
    expect(g.players[2].battlefield).toHaveLength(0);
    expect(g.winner).toBeNull();
    expect(g.opponents(0)).toEqual([1, 3]);
    g.goToCombat();
    g.declareAttackers([]);
    g.endTurn();
    expect(g.active).toBe(1);
    g.goToCombat();
    g.declareAttackers([]);
    g.endTurn();
    expect(g.active).toBe(3);
    g.players[1].life = 0;
    g.players[3].life = -2;
    g.checkState();
    expect(g.winner).toBe(0);
    expect(g.players[0].place).toBe(1);
    expect(g.players[1].place).toBe(2);
    expect(g.players[3].place).toBe(2);
  });

  test('when the active player is knocked out mid-turn, play moves on', () => {
    const g = table(3);
    g.players[0].life = 1;
    g.resolve(1, null, [{ k: 'lose', n: 1, who: { sel: 'each-opp' } }], []);
    g.checkState();
    expect(g.players[0].lost).toBe(true);
    expect(g.winner).toBeNull();
    expect(g.active).toBe(1);
    expect(g.phase).toBe('main1');
  });
});

describe('The One Ring', () => {
  test('protection when cast, burden counters, card draw, and upkeep life loss', () => {
    const plains = card('Plains');
    const g = new Game([Array(30).fill(plains), Array(30).fill(plains)], { seed: 2, first: 0 });
    for (const p of g.players) p.hand = [];
    lands(g, 0, 'Plains', 4);
    expect(g.cast(0, inHand(g, 0, 'The One Ring'))).toBe(true);
    const ring = g.players[0].battlefield.find((p) => p.card.name === 'The One Ring')!;
    expect(g.players[0].protected).toBe(true);
    // Opponents can't target or damage a protected player.
    expect(g.legalTargets(1, { sel: 'target', what: 'player' }).map((r) => (r.kind === 'player' ? r.id : -1))).not.toContain(0);
    g.resolve(1, null, [{ k: 'damage', n: 5, to: [{ sel: 'each-opp' }] }], []);
    expect(g.players[0].life).toBe(20);
    // Tap: a burden counter, then draw one card per counter.
    const hand = g.players[0].hand.length;
    expect(g.activate(0, ring.iid, 0)).toBe(true);
    expect(ring.named.burden).toBe(1);
    expect(g.players[0].hand.length).toBe(hand + 1);
    // Protection lasts until your next turn; then the upkeep costs 1 life per burden counter.
    g.endTurn();
    expect(g.players[0].protected).toBe(true);
    g.endTurn();
    expect(g.players[0].protected).toBe(false);
    expect(g.players[0].life).toBe(19);
    const before = g.players[0].hand.length;
    expect(g.activate(0, ring.iid, 0)).toBe(true);
    expect(ring.named.burden).toBe(2);
    expect(g.players[0].hand.length).toBe(before + 2);
  });
});

