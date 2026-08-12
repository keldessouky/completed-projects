import { Container, Graphics, Sprite } from 'pixi.js';
import { CONFIG } from '../config';
import type { Ctx } from '../core/game';
import { NPC, SYS, UI } from '../flavour';
import { checkAchievements, announce } from '../game/achievements';
import * as stats from '../game/stats';
import { questById } from '../world/quests';
import { npcById } from '../world/worldgen';
import { Btn } from './button';
import { panel, displayText, uiText } from './widgets';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/** Which flavour block a given NPC speaks from. */
function voiceFor(id: string): { name: string; greet: readonly string[]; nothing: readonly string[] } {
  if (id.startsWith('quartermaster')) return NPC.quartermaster;
  if (id === 'broker') return NPC.broker;
  return NPC.guide;
}

/**
 * Talking to somebody.
 *
 * An overlay rather than a scene: the world keeps rendering behind it, which is
 * the difference between "a conversation in a place" and "a menu that replaced
 * the game". It also means the world scene is never torn down and rebuilt for
 * two lines of dialogue.
 */
export function showDialogue(ctx: Ctx, npcId: string): void {
  const npc = npcById(npcId);
  const ws = ctx.world;
  if (!npc || !ws) return;

  const root = new Container();
  root.zIndex = 700;
  ctx.root.addChild(root);
  ctx.loop.paused = true;

  const close = (): void => {
    ctx.loop.paused = false;
    root.destroy({ children: true });
  };

  const dim = new Graphics();
  dim.rect(-40, -40, W + 80, H + 80).fill({ color: CONFIG.colors.ink, alpha: 0.55 });
  dim.eventMode = 'static';
  root.addChild(dim);

  const rebuild = (): void => {
    // the panel is rebuilt after every choice so quest state is never stale
    for (let i = root.children.length - 1; i >= 1; i--) root.children[i].destroy({ children: true });

    const voice = voiceFor(npcId);
    const { offer, ready } = ws.offeredBy(npcId);

    const lines: string[] = ready.length > 0 || offer.length > 0 ? [...voice.greet] : [...voice.nothing];
    const bodyH = 40 + lines.length * 22;
    const btnCount = (npc.role === 'vendor' ? 1 : 0) + offer.length + ready.length + 1;
    const h = bodyH + btnCount * 66 + 78;
    const y = H - Math.max(ctx.scaler.safeBottom(), 10) - h / 2 - 16;

    const wrap = new Container();
    wrap.position.set(W / 2, y);
    wrap.addChild(panel(ctx, W - 28, h));

    const portrait = new Sprite(ctx.atlas.get(
      npc.role === 'vendor' ? 'npc_vendor' : npc.role === 'quests' ? 'npc_quests' : 'npc_guide',
    ));
    portrait.anchor.set(0.5, 1);
    portrait.scale.set(1.1);
    portrait.position.set(-W / 2 + 58, -h / 2 + 6);
    wrap.addChild(portrait);

    const name = displayText(voice.name.toUpperCase(), 17, CONFIG.colors.amberBright, '700');
    name.anchor.set(0, 0.5);
    name.position.set(-W / 2 + 96, -h / 2 + 26);
    wrap.addChild(name);

    lines.forEach((line, i) => {
      const t = uiText(line, 13, CONFIG.colors.bone, '400', W - 90);
      t.anchor.set(0, 0);
      t.style.align = 'left';
      t.position.set(-W / 2 + 32, -h / 2 + 48 + i * 24);
      wrap.addChild(t);
    });

    let by = -h / 2 + bodyH + 46;
    const add = (label: string, kind: 'gold' | 'blue' | 'dark', onTap: () => void, note?: string): void => {
      const b = new Btn(ctx, { w: W - 76, h: 54, kind, label, labelSize: 17, onTap });
      b.position.set(0, by);
      wrap.addChild(b);
      if (note) {
        const n = uiText(note, 10, CONFIG.colors.boneDim, '600');
        n.position.set(0, by + 32);
        wrap.addChild(n);
      }
      by += 66;
    };

    // ── turn-ins first: they are the reason you walked back here ──
    for (const id of ready) {
      const q = questById(id)!;
      add(`Hand in: ${q.title}`, 'gold', () => {
        ws.complete(id);
        ctx.save.data.gold += q.rewardGold;
        const levels = stats.grantXp(ctx.save.data, q.rewardXp);
        ctx.system.push(SYS.questDone(q.title, q.rewardGold, q.rewardXp), 'good');
        if (levels > 0) ctx.system.push(SYS.levelUp(ctx.save.data.level, ctx.save.data.points), 'good');
        for (const a of checkAchievements(ctx.save.data, ws)) ctx.system.push(announce(a), 'good');
        ctx.audio.play('upgrade', { vol: 0.8 });
        ctx.save.data.world = ws.toSave();
        ctx.save.mark();
        rebuild();
      }, q.done);
    }

    for (const id of offer) {
      const q = questById(id)!;
      add(`Accept: ${q.title}`, 'blue', () => {
        ws.accept(id);
        ctx.system.push(SYS.questTaken(q.title), 'info');
        ctx.save.data.world = ws.toSave();
        ctx.save.mark();
        rebuild();
      }, q.brief);
    }

    if (npc.role === 'vendor') {
      add('Trade', 'gold', () => { close(); ctx.router.goto('shop', { npc: npcId }); });
    }

    add('Goodbye', 'dark', close);
    root.addChild(wrap);
  };

  rebuild();
  void UI;
}
