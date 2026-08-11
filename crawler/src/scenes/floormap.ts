import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG } from '../config';
import { CAST, NODE_LABEL, SYS, floorName, floorSubtitle } from '../flavour';
import { checkRunAchievements, announce } from '../game/achievements';
import { describe, rollLoot, tierLabel } from '../game/loot';
import { RunState } from '../game/runstate';
import * as stats from '../game/stats';
import type { EncounterResult, FloorNode, NodeKind } from '../types';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { showSettings } from '../ui/overlays';
import { Bar, displayText, uiText } from '../ui/widgets';
import { clockText } from './encounter/hud';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

const NODE_ICON: Record<NodeKind, string> = {
  entry: 'iconEntry',
  corridor: 'iconTunnel',
  mob: 'iconNest',
  loot: 'iconBox',
  safe: 'iconSafe',
  boss: 'iconBoss',
  stairs: 'iconStairs',
};

/**
 * The floor: a graph you route through under a countdown.
 *
 * This is where the crawl actually happens. Rooms are one-shot, the clock only
 * moves when you do, and the stairs stay shut until the boss is down — so
 * every tap is the same question in a different disguise: is there time for
 * one more room, or do you take what you have to the boss?
 */
export class FloorMapScene extends Scene {
  private clock!: NumberDisplay;
  private nodeViews = new Map<string, Container>();
  private edges = new Graphics();

  override exit(): void { this.ctx.mapNodes = null; }

  enter(data?: unknown): void {
    const ctx = this.ctx;
    let rs = ctx.run;

    // Arriving from an encounter: bank its outcome before drawing anything.
    const result = (data as { result?: EncounterResult })?.result;
    if (!rs) { ctx.router.goto('title'); return; }
    if (result?.survived) this.bankEncounter(rs, result);
    else if (result) rs.failLine = result.failReason;

    if (rs.timedOut || rs.timeLeft <= 0 || rs.party <= 0) { this.endFloor(false); return; }

    this.paint(rs);
    ctx.save.data.inProgress = rs.toSave();
    ctx.save.mark();
    ctx.audio.music('musicTitle');
  }

  private bankEncounter(rs: RunState, result: EncounterResult): void {
    const ctx = this.ctx;
    const save = ctx.save.data;
    rs.markVisited(result.nodeId);
    const gained = stats.grantXp(save, rs.xpThisRun);
    rs.xpThisRun = 0;
    if (gained > 0) ctx.system.push(SYS.levelUp(save.level, save.points), 'good');
    for (const a of checkRunAchievements(save, rs)) ctx.system.push(announce(a), 'good');
    ctx.save.mark();
  }

  // ─────────────────────────── layout ───────────────────────────

  private paint(rs: RunState): void {
    const ctx = this.ctx;
    const save = ctx.save.data;

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.pit);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);

    // ── header: which floor, and how long it has left ──
    const title = displayText(`FLOOR ${rs.floor + 1} — ${floorName(rs.floor).toUpperCase()}`, 17, CONFIG.colors.bone, '900');
    title.position.set(W / 2, topY + 20);
    const sub = uiText(floorSubtitle(rs.floor), 11, CONFIG.colors.boneDim, '400', W - 60);
    sub.position.set(W / 2, topY + 40);

    const clockLabel = uiText('STAIRS SEAL IN', 9, CONFIG.colors.boneDim, '600');
    clockLabel.position.set(W / 2, topY + 62);
    this.clock = new NumberDisplay(ctx.atlas, 5, 0.72, CONFIG.colors.bone);
    this.clock.position.set(W / 2, topY + 88);
    this.setClock(rs.timeLeft);
    this.container.addChild(title, sub, clockLabel, this.clock);

    // ── status strip: party, gold, level ──
    const stripY = topY + 122;
    const party = new Sprite(ctx.atlas.get('iconParty'));
    party.anchor.set(0.5); party.scale.set(0.7);
    party.position.set(30, stripY);
    const partyNum = new NumberDisplay(ctx.atlas, 4, 0.44, CONFIG.colors.bone, 'left');
    partyNum.position.set(46, stripY);
    partyNum.set(String(rs.party));

    const coin = new Sprite(ctx.atlas.get('coin'));
    coin.anchor.set(0.5); coin.scale.set(0.8);
    coin.position.set(W / 2 - 22, stripY);
    const goldNum = new NumberDisplay(ctx.atlas, 6, 0.44, CONFIG.colors.amberBright, 'left');
    goldNum.position.set(W / 2 - 6, stripY);
    goldNum.set(String(save.gold + rs.goldThisRun));

    const lvl = uiText(`LV ${save.level}`, 12, CONFIG.colors.sysBright, '600');
    lvl.position.set(W - 66, stripY - 7);
    const xpBar = new Bar(74, 6, CONFIG.colors.sysBright);
    xpBar.position.set(W - 66, stripY + 9);
    xpBar.set(stats.xpFrac(save));
    this.container.addChild(party, partyNum, coin, goldNum, lvl, xpBar);

    // ── the graph ──
    const graphTop = stripY + 40;
    const footerH = 74;
    const graphBottom = H - Math.max(ctx.scaler.safeBottom(), 10) - footerH;
    const layers = rs.def.layers;
    const rowH = (graphBottom - graphTop) / Math.max(1, layers.length - 1);

    this.container.addChild(this.edges);

    const pos = new Map<string, { x: number; y: number }>();
    layers.forEach((ids, li) => {
      const y = graphTop + li * rowH;
      ids.forEach((id, i) => {
        const spread = Math.min(150, (W - 120) / 2);
        const x = ids.length === 1 ? W / 2 : W / 2 + (i - (ids.length - 1) / 2) * (spread * 2 / (ids.length - 1)) * 0.62;
        pos.set(id, { x, y });
      });
    });

    // edges first so nodes sit on top of them
    this.edges.clear();
    const drawn = new Set<string>();
    for (const id of Object.keys(rs.def.nodes)) {
      const a = pos.get(id)!;
      for (const other of rs.def.nodes[id].links) {
        const key = id < other ? `${id}|${other}` : `${other}|${id}`;
        if (drawn.has(key)) continue;
        drawn.add(key);
        const b = pos.get(other)!;
        const live = rs.at === id || rs.at === other;
        this.edges.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({
          color: live ? CONFIG.colors.sysBright : CONFIG.colors.concrete,
          width: live ? 2.5 : 1.5,
          alpha: live ? 0.9 : 0.5,
        });
      }
    }

    for (const [id, p] of pos) {
      const view = this.nodeView(rs, rs.def.nodes[id]);
      view.position.set(p.x, p.y);
      this.nodeViews.set(id, view);
      this.container.addChild(view);
    }

    // publish the layout so the smoke harness can tap the real nodes
    ctx.mapNodes = () => [...pos].map(([id, q]) => ({
      id,
      kind: rs.def.nodes[id].kind,
      layer: rs.def.nodes[id].layer,
      x: q.x,
      y: q.y,
      walkable: rs.canReach(id) && !(id === rs.def.stairs && !rs.bossDown),
      spent: rs.isSpent(id),
    }));

    // ── footer ──
    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 32;
    const sheet = new Btn(ctx, {
      w: 150, h: 52, kind: save.points > 0 ? 'gold' : 'dark',
      label: save.points > 0 ? `Spend ${save.points}` : 'Character',
      labelSize: 16,
      onTap: () => ctx.router.goto('charsheet'),
    });
    sheet.position.set(96, footY);
    const gear = new Btn(ctx, { w: 52, h: 52, kind: 'dark', icon: 'iconGear', onTap: () => showSettings(ctx) });
    gear.position.set(W - 44, footY);
    const hint = uiText(
      rs.bossDown ? 'The stairs are open.' : `Tap a connected room. ${CONFIG.floors.travelCostSec}s to move.`,
      11, CONFIG.colors.boneDim,
    );
    hint.position.set(W / 2 + 24, footY + 26);
    this.container.addChild(sheet, gear, hint);

    // first arrival on the floor: the System introduces itself
    if (rs.elapsed <= 0.01 && !save.cleared[rs.floor]) {
      ctx.system.push(SYS.welcome(), 'info');
      ctx.system.push(SYS.floorOpen(rs.floor + 1, Math.round(rs.def.timeLimitSec / 60)), 'bad');
      if (save.level === 1) ctx.system.push(SYS.firstClass(), 'info');
    }
  }

  private setClock(sec: number): void {
    this.clock.set(clockText(sec));
    this.clock.tint = sec <= CONFIG.floors.warnAtSec ? CONFIG.colors.trapRedBright : CONFIG.colors.bone;
  }

  /** One node: icon, label, cost, and its reachable/spent/current state. */
  private nodeView(rs: RunState, node: FloorNode): Container {
    const ctx = this.ctx;
    const wrap = new Container();
    const here = rs.at === node.id;
    const spent = rs.isSpent(node.id);
    const walkable = rs.canReach(node.id);
    // A cleared room is still a corridor you can walk through — it just pays
    // nothing. Only the reward state dims; the tap target stays live.
    const reachable = walkable && !spent;
    const locked = node.kind === 'stairs' && !rs.bossDown;
    const size = node.kind === 'boss' || node.kind === 'stairs' ? 66 : 56;

    const tint = node.kind === 'boss' ? CONFIG.colors.trapRed
      : node.kind === 'safe' ? CONFIG.colors.goodTeal
      : node.kind === 'loot' ? CONFIG.colors.amber
      : CONFIG.colors.sys;

    const plate = new Graphics();
    plate.roundRect(-size / 2, -size / 2, size, size, 5)
      .fill({ color: here ? CONFIG.colors.sysDeep : CONFIG.colors.pitLift, alpha: 0.95 })
      .stroke({
        color: here ? CONFIG.colors.bone : reachable ? tint : CONFIG.colors.concrete,
        width: here || reachable ? 2.5 : 1.5,
        alpha: spent ? 0.4 : 1,
      });
    wrap.addChild(plate);

    const icon = new Sprite(ctx.atlas.get(locked ? 'iconLock' : NODE_ICON[node.kind]));
    icon.anchor.set(0.5);
    icon.scale.set(0.78);
    icon.tint = spent ? CONFIG.colors.concrete : reachable || here ? CONFIG.colors.bone : CONFIG.colors.boneDim;
    icon.position.set(0, -6);
    wrap.addChild(icon);

    const caption = node.kind === 'loot' && node.tier ? tierLabel(node.tier) : NODE_LABEL[node.kind];
    const cap = uiText(spent ? 'CLEARED' : caption.toUpperCase(), 8, spent ? CONFIG.colors.concrete : CONFIG.colors.boneDim, '600');
    cap.position.set(0, size / 2 - 11);
    wrap.addChild(cap);

    // the clock cost of committing to this room, so routing is an informed bet
    if (!spent && node.estSec > 0) {
      const cost = uiText(`~${node.estSec}s`, 9, reachable ? CONFIG.colors.amberBright : CONFIG.colors.concrete, '600');
      cost.position.set(0, size / 2 + 9);
      wrap.addChild(cost);
    }

    if (here) {
      const ring = new Graphics();
      ring.roundRect(-size / 2 - 5, -size / 2 - 5, size + 10, size + 10, 8)
        .stroke({ color: CONFIG.colors.amberBright, width: 2, alpha: 0.9 });
      wrap.addChildAt(ring, 0);
      const you = uiText(CAST.hero.toUpperCase(), 8, CONFIG.colors.amberBright, '800');
      you.position.set(0, -size / 2 - 13);
      wrap.addChild(you);
    }

    if (walkable && !locked) {
      wrap.eventMode = 'static';
      wrap.cursor = 'pointer';
      // pad the hit area so a 56px plate still clears the 52pt tap-target floor
      wrap.hitArea = { contains: (x: number, y: number) => Math.abs(x) <= 34 && Math.abs(y) <= 34 };
      wrap.once('pointertap', () => this.go(node));
    }
    wrap.alpha = spent && !here ? 0.55 : here ? 1 : reachable ? 1 : 0.72;
    return wrap;
  }

  // ─────────────────────────── movement ───────────────────────────

  private go(node: FloorNode): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    ctx.audio.play('uiTap');

    if (!rs.travelTo(node.id)) { this.endFloor(false); return; }

    // Walking back through a room you already cleared costs the travel time
    // and nothing else — no re-fight, no second payout.
    if (rs.isSpent(node.id) && node.kind !== 'stairs') {
      ctx.router.goto('floormap');
      return;
    }

    switch (node.kind) {
      case 'corridor':
      case 'mob':
      case 'boss':
        ctx.save.data.inProgress = rs.toSave();
        ctx.save.flush();
        ctx.router.goto('encounter', { node: node.id });
        return;
      case 'loot':
        this.openLoot(node);
        return;
      case 'safe':
        ctx.router.goto('safe');
        return;
      case 'stairs':
        this.endFloor(true);
        return;
      default:
        ctx.router.goto('floormap');
    }
  }

  /** Loot resolves in place — a box is a payout, not a room. */
  private openLoot(node: FloorNode): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    if (!rs.spendTime(CONFIG.floors.lootCostSec)) { this.endFloor(false); return; }
    rs.markVisited(node.id);
    ctx.router.goto('loot', { node: node.id, tier: node.tier ?? 'bronze' });
  }

  // ─────────────────────────── floor end ───────────────────────────

  private endFloor(win: boolean): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    const save = ctx.save.data;

    // XP earned but not yet banked (a floor can end mid-encounter)
    const levels = stats.grantXp(save, rs.xpThisRun);
    rs.xpThisRun = 0;

    // The ending screen lists these itself, so they are collected here rather
    // than pushed to the feed — a toast that outlives its own scene is noise.
    const newAch = win ? checkRunAchievements(save, rs) : [];
    ctx.system.clear();
    const p = rs.progress();

    if (win) {
      save.gold += rs.goldThisRun + CONFIG.economy.clearBonus;
      save.cleared[rs.floor] = true;
      const t = Math.round(rs.elapsed);
      if (save.bestTime[rs.floor] === 0 || t < save.bestTime[rs.floor]) save.bestTime[rs.floor] = t;
      if (rs.floor + 1 < CONFIG.floors.count) save.unlocked = Math.max(save.unlocked, rs.floor + 1);
    } else {
      save.gold += Math.round(rs.goldThisRun * CONFIG.economy.failConsolationFrac);
      save.totalDeaths += 1;
    }
    save.totalRuns += 1;
    save.inProgress = null;
    ctx.save.flush();

    const worst = rs.worstLoss();
    const outcome = {
      floor: rs.floor,
      win,
      timeLeft: rs.timeLeft,
      elapsedSec: rs.elapsed,
      partyAtEnd: rs.party,
      partyPeak: rs.partyPeak,
      goldEarned: win ? rs.goldThisRun + CONFIG.economy.clearBonus
        : Math.round(rs.goldThisRun * CONFIG.economy.failConsolationFrac),
      xpEarned: 0,
      kills: rs.kills,
      levelsGained: levels,
      nodesVisited: p.visited,
      nodesTotal: p.total,
      failReason: rs.failLine || (worst.n > 0 ? `You lost ${worst.n} to ${worst.source}.` : ''),
      newAchievements: newAch.map((a) => a.name),
    };
    ctx.run = null;
    ctx.router.goto(win ? 'clear' : 'death', outcome);
  }
}

/** Roll a box and apply it. Exposed so the loot scene and tests share one path. */
export function applyLoot(ctx: import('../core/game').Ctx, tier: import('../config').LootTier): ReturnType<typeof rollLoot> {
  const save = ctx.save.data;
  const rs = ctx.run!;
  const roll = rollLoot(save, tier);
  rs.goldThisRun += roll.gold;
  rs.xpThisRun += roll.xp;
  if (roll.party > 0) rs.setParty(rs.party + roll.party);
  if (roll.statPoint) save.points += 1;
  ctx.system.push([...SYS.lootOpen(tierLabel(roll.tier)), ...describe(roll)], 'good');
  ctx.save.mark();
  return roll;
}
