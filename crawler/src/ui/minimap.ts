import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { CONFIG } from '../config';
import { getMinimapTexture } from '../assets/terrain';
import type { GameAtlas } from '../assets/atlas';
import type { Poi, PoiKind } from '../types';
import { getWorld } from '../world/worldgen';
import type { WorldState } from '../world/worldstate';

const M = CONFIG.minimap;
const FOG = M.fogCells;

const MARKER: Record<PoiKind, string> = {
  town: 'markTown',
  camp: 'markCamp',
  ruin: 'markRuin',
  shrine: 'markShrine',
  lair: 'markLair',
};

const MARKER_TINT: Record<PoiKind, number> = {
  town: CONFIG.colors.goodTeal,
  camp: CONFIG.colors.hpRedBright,
  ruin: CONFIG.colors.boneDim,
  shrine: CONFIG.colors.sysBright,
  lair: CONFIG.colors.amberBright,
};

/**
 * Corner minimap: the world at a glance, everywhere you have actually been.
 *
 * Fog lives in a 64×64 canvas rather than a few thousand Graphics rectangles —
 * one texture upload when it changes beats redrawing 900 rects every frame,
 * and it keeps the whole widget to four draw calls.
 */
export class Minimap extends Container {
  private view = new Container();
  private world: Sprite;
  private fogSprite: Sprite;
  private fogCanvas: HTMLCanvasElement;
  private fogCtx: CanvasRenderingContext2D;
  private fogTex: Texture;
  private markers = new Map<string, Sprite>();
  private player: Sprite;
  private fogDirty = true;
  private lastRevealed = -1;

  constructor(atlas: GameAtlas, private ws: WorldState) {
    super();
    const size = M.size;

    const frame = new Graphics();
    frame.roundRect(-size / 2 - 2, -size / 2 - 2, size + 4, size + 4, 4)
      .fill({ color: CONFIG.colors.ink, alpha: 0.72 })
      .stroke({ color: CONFIG.colors.bone, width: 1.5, alpha: 0.5 });
    this.addChild(frame);

    // everything inside is clipped to the frame by a mask
    const mask = new Graphics();
    mask.roundRect(-size / 2, -size / 2, size, size, 3).fill(0xffffff);
    this.addChild(mask);
    this.view.mask = mask;
    this.addChild(this.view);

    this.world = new Sprite(getMinimapTexture());
    this.world.anchor.set(0.5);
    this.view.addChild(this.world);

    this.fogCanvas = document.createElement('canvas');
    this.fogCanvas.width = FOG;
    this.fogCanvas.height = FOG;
    this.fogCtx = this.fogCanvas.getContext('2d')!;
    this.fogTex = Texture.from(this.fogCanvas);
    this.fogTex.source.scaleMode = 'nearest';
    this.fogSprite = new Sprite(this.fogTex);
    this.fogSprite.anchor.set(0.5);
    this.view.addChild(this.fogSprite);

    for (const p of getWorld().pois) {
      const s = new Sprite(atlas.get(MARKER[p.kind]));
      s.anchor.set(0.5);
      s.scale.set(p.kind === 'lair' || p.kind === 'town' ? 0.6 : 0.5);
      s.tint = MARKER_TINT[p.kind];
      s.visible = false;
      this.view.addChild(s);
      this.markers.set(p.id, s);
    }

    this.player = new Sprite(atlas.get('markPlayer'));
    this.player.anchor.set(0.5);
    this.player.scale.set(0.55);
    this.player.tint = CONFIG.colors.white;
    this.view.addChild(this.player);
  }

  /** Call whenever the fog array has been written to. */
  markFogDirty(): void { this.fogDirty = true; }

  private redrawFog(): void {
    const img = this.fogCtx.createImageData(FOG, FOG);
    for (let i = 0; i < FOG * FOG; i++) {
      const seen = this.ws.fog[i] === 1;
      const o = i * 4;
      img.data[o] = 8; img.data[o + 1] = 7; img.data[o + 2] = 11;
      // seen ground still reads as "remembered, not live": a light veil stays
      img.data[o + 3] = seen ? 40 : 236;
    }
    this.fogCtx.putImageData(img, 0, 0);
    this.fogTex.source.update();
    this.fogDirty = false;
  }

  update(): void {
    if (this.fogDirty) this.redrawFog();

    const size = M.size;
    const scale = size / M.span;                  // minimap px per world unit
    const worldScale = (CONFIG.world.size * scale) / this.world.texture.width;
    this.world.scale.set(worldScale);
    this.fogSprite.scale.set((CONFIG.world.size * scale) / FOG);

    // the player sits at the centre; everything else is offset from them
    const ox = -this.ws.x * scale;
    const oy = -this.ws.y * scale;
    this.world.position.set(ox + (CONFIG.world.size * scale) / 2, oy + (CONFIG.world.size * scale) / 2);
    this.fogSprite.position.copyFrom(this.world.position);

    for (const p of getWorld().pois) {
      const s = this.markers.get(p.id)!;
      const known = this.ws.discovered.has(p.id);
      s.visible = known;
      if (!known) continue;
      s.position.set(ox + p.x * scale, oy + p.y * scale);
      // a cleared camp stops shouting for attention
      s.alpha = p.kind === 'camp' && this.ws.isCleared(p.id) ? 0.4 : 1;
      this.dimIfOutside(s, size);
    }

    this.player.position.set(0, 0);
    // one cheap signal that exploration is progressing
    if (this.lastRevealed !== this.ws.discovered.size) this.lastRevealed = this.ws.discovered.size;
  }

  /** Markers outside the frame are hidden rather than clipped mid-glyph. */
  private dimIfOutside(s: Sprite, size: number): void {
    const half = size / 2 - 4;
    if (Math.abs(s.x) > half || Math.abs(s.y) > half) s.visible = false;
  }

  /** Marker positions in design space, for the smoke harness. */
  probe(): { id: string; x: number; y: number; visible: boolean }[] {
    const out: { id: string; x: number; y: number; visible: boolean }[] = [];
    for (const p of getWorld().pois as Poi[]) {
      const s = this.markers.get(p.id);
      if (!s) continue;
      out.push({ id: p.id, x: this.x + s.x, y: this.y + s.y, visible: s.visible });
    }
    return out;
  }
}
