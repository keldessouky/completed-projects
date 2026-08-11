import { Container, Graphics } from 'pixi.js';
import { CONFIG } from '../config';
import { CAST, NODE_LABEL, VENDOR } from '../flavour';
import { Btn } from '../ui/button';
import { NumberDisplay } from '../ui/digits';
import { displayText, panel, uiText } from '../ui/widgets';
import { Scene } from './scene';

const W = CONFIG.design.width;
const H = CONFIG.design.height;

/**
 * The safe room: the only place on the floor where nothing is trying to kill
 * you, and the only place the clock is a flat fee rather than a drain. Heal is
 * free and automatic; everything else costs gold you could have taken to the
 * next floor.
 */
export class SafeScene extends Scene {
  private goldNum!: NumberDisplay;
  private partyNum!: NumberDisplay;
  private log!: import('pixi.js').Text;

  enter(): void {
    const ctx = this.ctx;
    const rs = ctx.run;
    if (!rs) { ctx.router.goto('title'); return; }

    const bg = new Graphics();
    bg.rect(-240, -240, W + 480, H + 480).fill(CONFIG.colors.pit);
    this.container.addChild(bg);

    const topY = Math.max(ctx.scaler.safeTop(), 12);
    const title = displayText(NODE_LABEL.safe.toUpperCase(), 26, CONFIG.colors.goodTeal, '900');
    title.position.set(W / 2, topY + 44);
    const sub = uiText(`${CAST.guide} has left the lights on.`, 12, CONFIG.colors.boneDim);
    sub.position.set(W / 2, topY + 70);
    this.container.addChild(title, sub);

    // ── free heal, applied on arrival ──
    const target = Math.round(rs.partyPeak * CONFIG.safe.healToFrac);
    const healed = Math.max(0, target - rs.party);
    if (healed > 0) {
      rs.setParty(rs.party + healed);
      ctx.audio.play('partyGain');
    }

    const stripY = topY + 108;
    this.partyNum = this.stat('PARTY', W / 2 - 78, stripY, String(rs.party), CONFIG.colors.bone);
    this.goldNum = this.stat('GOLD', W / 2 + 78, stripY, String(ctx.save.data.gold + rs.goldThisRun), CONFIG.colors.amberBright);

    this.log = uiText(
      healed > 0 ? `${healed} stragglers caught up with you.` : 'Nobody left behind to catch up.',
      12, healed > 0 ? CONFIG.colors.goodTeal : CONFIG.colors.boneDim,
    );
    this.log.position.set(W / 2, stripY + 44);
    this.container.addChild(this.log);

    // ── vendor ──
    const vendY = stripY + 96;
    const vendTitle = displayText(VENDOR.title.toUpperCase(), 15, CONFIG.colors.bone, '700');
    vendTitle.position.set(W / 2, vendY);
    const vendFlavour = uiText(VENDOR.flavour, 10, CONFIG.colors.boneDim, '400', W - 80);
    vendFlavour.position.set(W / 2, vendY + 22);
    this.container.addChild(vendTitle, vendFlavour);

    this.offer(
      vendY + 66,
      `+${CONFIG.safe.vendorPartyGain} Party`,
      CONFIG.safe.vendorPartyCost,
      () => {
        rs.setParty(rs.party + CONFIG.safe.vendorPartyGain);
        this.log.text = `${CONFIG.safe.vendorPartyGain} more bodies. They look nervous.`;
      },
    );
    this.offer(
      vendY + 142,
      '+1 Attribute Point',
      CONFIG.safe.vendorStatCost,
      () => {
        ctx.save.data.points += 1;
        this.log.text = 'One attribute point. Spend it on the character sheet.';
      },
    );

    // ── exit ──
    const footY = H - Math.max(ctx.scaler.safeBottom(), 10) - 44;
    const sheet = new Btn(ctx, {
      w: 150, h: 56, kind: ctx.save.data.points > 0 ? 'gold' : 'dark',
      label: 'Character', labelSize: 17,
      onTap: () => ctx.router.goto('charsheet'),
    });
    sheet.position.set(W / 2 - 92, footY);
    const leave = new Btn(ctx, {
      w: 150, h: 56, kind: 'blue', label: 'Leave', labelSize: 17,
      onTap: () => ctx.router.goto('floormap'),
    });
    leave.position.set(W / 2 + 92, footY);
    this.container.addChild(sheet, leave);

    ctx.audio.music('musicTitle');
    ctx.save.data.inProgress = rs.toSave();
    ctx.save.mark();
  }

  private stat(label: string, x: number, y: number, value: string, tint: number): NumberDisplay {
    const l = uiText(label, 9, CONFIG.colors.boneDim, '600');
    l.position.set(x, y - 18);
    const n = new NumberDisplay(this.ctx.atlas, 6, 0.5, tint);
    n.position.set(x, y + 4);
    n.set(value);
    this.container.addChild(l, n);
    return n;
  }

  /** One vendor line: what it is, what it costs, and whether you can afford it. */
  private offer(y: number, label: string, cost: number, buy: () => void): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    const wrap = new Container();
    wrap.position.set(W / 2, y);
    wrap.addChild(panel(ctx, W - 60, 62));

    const name = uiText(label, 16, CONFIG.colors.bone, '600');
    name.anchor.set(0, 0.5);
    name.position.set(-W / 2 + 46, -6);
    const price = uiText(`${cost} gold`, 12, CONFIG.colors.amberBright, '600');
    price.anchor.set(0, 0.5);
    price.position.set(-W / 2 + 46, 14);
    wrap.addChild(name, price);

    const btn = new Btn(ctx, {
      w: 92, h: 44, kind: 'gold', label: 'Buy', labelSize: 15,
      onTap: () => {
        // Run gold has not been banked yet, so spend it first — otherwise a
        // player could buy from a wallet the run has not actually earned.
        const total = ctx.save.data.gold + rs.goldThisRun;
        if (total < cost) {
          this.log.text = 'Declined. Insufficient funds, and the machine is judging you.';
          ctx.audio.play('doorBad', { vol: 0.5 });
          return;
        }
        const fromRun = Math.min(rs.goldThisRun, cost);
        rs.goldThisRun -= fromRun;
        ctx.save.data.gold -= cost - fromRun;
        buy();
        ctx.audio.play('upgrade');
        ctx.haptics.doorTap();
        this.refresh();
      },
    });
    btn.position.set(W / 2 - 92, 0);
    wrap.addChild(btn);
    this.container.addChild(wrap);
  }

  private refresh(): void {
    const ctx = this.ctx;
    const rs = ctx.run!;
    this.goldNum.set(String(ctx.save.data.gold + rs.goldThisRun));
    this.partyNum.set(String(rs.party));
    ctx.save.mark();
  }
}
